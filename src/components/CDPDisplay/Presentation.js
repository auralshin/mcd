import React, { useEffect, useState } from 'react';
import { Address } from '@makerdao/ui-components-core';
import useLanguage from 'hooks/useLanguage';
import useEventHistory from 'hooks/useEventHistory';
import useMaker from 'hooks/useMaker';

import { TextBlock } from 'components/Typography';
import PageContentLayout from 'layouts/PageContentLayout';
import { Box, Grid, Flex, Text } from '@makerdao/ui-components-core';
import History from './History';
import {
  ActionButton,
  ActionContainerRow,
  AmountDisplay,
  CdpViewCard,
  ExtraInfo,
  InfoContainerRow
} from './subcomponents';
import theme from '../../styles/theme';
import FullScreenAction from './FullScreenAction';
import debug from 'debug';
import useNotification from 'hooks/useNotification';
import useAnalytics from 'hooks/useAnalytics';
import useEmergencyShutdown from 'hooks/useEmergencyShutdown';
import { FeatureFlags } from 'utils/constants';
import { NotificationList, SAFETY_LEVELS } from 'utils/constants';
import { formatter, prettifyNumber } from 'utils/ui';
import BigNumber from 'bignumber.js';
import NextPriceLiquidation from '../NotificationContent/NextPriceLiquidatation';
import useOraclePrices from 'hooks/useOraclePrices';
import { fromRad } from '@makerdao/dai/dist/src/utils/conversion';
import { DAI } from '@makerdao/dai-plugin-mcd';
const log = debug('maker:CDPDisplay/Presentation');
const { FF_VAULT_HISTORY } = FeatureFlags;

export default function({
  vault,
  showSidebar,
  account,
  network,
  cdpOwner,
  showVaultHistory = true
}) {
  const { lang } = useLanguage();
  const { maker } = useMaker();

  const { emergencyShutdownActive } = useEmergencyShutdown();
  const { trackBtnClick } = useAnalytics('CollateralView');
  let {
    ownerAddress,
    collateralAmount,
    collateralValue,
    collateralizationRatio: rawCollateralizationRatio,
    liquidationPrice: rawLiquidationPrice,
    vaultType,
    unlockedCollateral,
    liquidationRatio,
    minSafeCollateralAmount,
    debtValue,
    debtFloor,
    vaultAddress
  } = vault;

  log(`Rendering vault #${vault.id}`);

  const gem = collateralAmount?.symbol;
  let liquidationPrice = formatter(rawLiquidationPrice);
  let collateralizationRatio = formatter(rawCollateralizationRatio, {
    percentage: true
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const eventHistory =
    FF_VAULT_HISTORY && showVaultHistory ? useEventHistory(vault.id) : null;

  if (['Infinity', Infinity, 'NaN', NaN].includes(liquidationPrice))
    liquidationPrice = lang.cdp_page.not_applicable;
  if (['Infinity', Infinity, 'NaN', NaN].includes(collateralizationRatio))
    collateralizationRatio = lang.cdp_page.not_applicable;
  const isProxyLess = !cdpOwner; // cdp not created through our proxy
  const isOwner =
    !isProxyLess &&
    account &&
    account.address.toLowerCase() === cdpOwner.toLowerCase();

  const [actionShown, setActionShown] = useState(null);
  const {
    addNotification,
    deleteNotifications,
    notificationExists
  } = useNotification();

  const { currentPrice, nextPrice } = useOraclePrices({ gem });

  const vaultUnderDustLimit =
    debtValue.toBigNumber().gt(0) && debtValue.toBigNumber().lt(debtFloor);
  const totalGenerateableDai = debtValue.plus(vault.daiAvailable);

  useEffect(() => {
    if (
      isOwner &&
      eventHistory?.length &&
      eventHistory.some(({ type }) => type === 'BITE')
    ) {
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const cutOff = Math.floor((now - sevenDays) / 1000);

      const recentEvents = eventHistory
        .filter(({ type }) => type === 'BITE')
        .filter(({ timestamp }) => timestamp >= cutOff);

      const sumCollateralLiquidated = recentEvents.reduce(
        (acc, { amount }) => acc.plus(amount),
        BigNumber(0)
      );
      if (recentEvents?.length) {
        addNotification({
          id: NotificationList.VAULT_IS_LIQUIDATED,
          content: lang.formatString(
            lang.notifications.vault_is_liquidated,
            `${formatter(sumCollateralLiquidated)} ${gem}`
          ),
          level: SAFETY_LEVELS.WARNING
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventHistory?.length]);

  useEffect(() => {
    const {
      VAULT_BELOW_NEXT_PRICE,
      VAULT_BELOW_CURRENT_PRICE
    } = NotificationList;

    if (
      isOwner &&
      !['Infinity', Infinity, 'NaN', NaN].includes(
        rawLiquidationPrice.toBigNumber().toString()
      ) &&
      currentPrice &&
      nextPrice
    ) {
      if (
        currentPrice.lt(rawLiquidationPrice.toBigNumber()) &&
        !notificationExists(VAULT_BELOW_CURRENT_PRICE)
      ) {
        console.log(`raw Liquidation price is ${rawLiquidationPrice}`)

        const currentCollateralNeeded = minSafeCollateralAmount
          .toBigNumber()
          .minus(collateralAmount.toBigNumber());

        const currentDebtNeeded = debtValue
          .toBigNumber()
          .minus(
            collateralValue.toBigNumber().div(liquidationRatio.toBigNumber())
          );

        if (notificationExists(VAULT_BELOW_NEXT_PRICE)) {
          deleteNotifications([VAULT_BELOW_NEXT_PRICE]);
        }
        addNotification({
          id: NotificationList.VAULT_BELOW_CURRENT_PRICE,
          content: lang.formatString(
            lang.notifications.vault_below_current_price,
            vaultType,
            `${formatter(currentCollateralNeeded)} ${gem}`,
            `${formatter(currentDebtNeeded)} INRC`
          ),
          level: SAFETY_LEVELS.DANGER
        });
      } else if (
        currentPrice.gte(rawLiquidationPrice.toBigNumber()) &&
        nextPrice.lt(rawLiquidationPrice.toBigNumber()) &&
        !notificationExists(NotificationList.VAULT_BELOW_NEXT_PRICE)
      ) {
        const nextCollateralNeeded = debtValue
          .times(liquidationRatio)
          .div(nextPrice)
          .toBigNumber()
          .minus(collateralAmount.toBigNumber());

        const nextDebtNeeded = debtValue.toBigNumber().minus(
          collateralAmount
            .times(nextPrice)
            .toBigNumber()
            .div(liquidationRatio.toBigNumber())
        );

        if (notificationExists(VAULT_BELOW_CURRENT_PRICE)) {
          deleteNotifications([VAULT_BELOW_CURRENT_PRICE]);
        }
        addNotification({
          id: NotificationList.VAULT_BELOW_NEXT_PRICE,
          content: (
            <NextPriceLiquidation
              vaultType={vaultType}
              collateral={formatter(nextCollateralNeeded)}
              debt={formatter(nextDebtNeeded)}
            />
          ),
          level: SAFETY_LEVELS.WARNING
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPrice,
    nextPrice,
    rawLiquidationPrice,
    debtValue,
    collateralAmount,
    collateralValue,
    liquidationRatio,
    minSafeCollateralAmount
  ]);

  useEffect(() => {
    const reclaimCollateral = async () => {
      const txObject = maker
        .service('mcd:cdpManager')
        .reclaimCollateral(vault.id, unlockedCollateral.toFixed());
      await txObject;
      deleteNotifications([NotificationList.CLAIM_COLLATERAL]);
    };

    if (isOwner && unlockedCollateral > 0) {
      const claimCollateralNotification = lang.formatString(
        lang.notifications.claim_collateral,
        gem,
        unlockedCollateral &&
          prettifyNumber(unlockedCollateral, false, null, false),
        gem
      );

      addNotification({
        id: NotificationList.CLAIM_COLLATERAL,
        content: claimCollateralNotification,
        level: SAFETY_LEVELS.WARNING,
        hasButton: isOwner,
        buttonLabel: lang.notifications.claim,
        onClick: () => reclaimCollateral()
      });
    }

    if (!isOwner && account) {
      addNotification({
        id: NotificationList.NON_VAULT_OWNER,
        content: lang.formatString(
          lang.notifications.non_vault_owner,
          isProxyLess ? (
            vault.id
          ) : (
            <Address full={cdpOwner} shorten={true} expandable={false} />
          )
        ),
        level: SAFETY_LEVELS.WARNING
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, account, vault, unlockedCollateral]);

  useEffect(() => {
    const reclaimDAI = async daiAmount => {
      const txObject = maker
        .service('mcd:cdpManager')
        .draw(vault.id, vaultType, daiAmount);
      await txObject;
      deleteNotifications([NotificationList.CLAIM_DAI]);
    };

    (async () => {
      const daiSentToUrn = DAI(
        fromRad(await maker.service('mcd:systemData').vat.dai(vaultAddress))
      );
      console.log(daiSentToUrn);
      if (isOwner && daiSentToUrn.gt(0)) {
        const claimDaiNotification = lang.formatString(
          lang.notifications.claim_dai,
          daiSentToUrn && prettifyNumber(daiSentToUrn, false, null, false)
        );

        addNotification({
          id: NotificationList.CLAIM_DAI,
          content: claimDaiNotification,
          level: SAFETY_LEVELS.WARNING,
          hasButton: isOwner,
          buttonLabel: lang.notifications.claim,
          onClick: () => reclaimDAI(daiSentToUrn)
        });
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault]);

  useEffect(() => {
    if (isOwner && vaultUnderDustLimit) {
      const amnt = formatter(debtFloor.minus(debtValue.toBigNumber()), {
        rounding: BigNumber.ROUND_HALF_UP
      });
      addNotification({
        id: NotificationList.VAULT_UNDER_DUST,
        content: lang.formatString(
          lang.notifications.vault_under_dust_limit,
          amnt,
          amnt
        ),
        level: SAFETY_LEVELS.WARNING,
        hasButton: true,
        buttonLabel: 'Deposit & Generate',
        onClick: () =>
          showAction({ type: 'depositAndGenerate', props: { vault } })
      });
    }
    if (
      !vaultUnderDustLimit &&
      notificationExists(NotificationList.VAULT_UNDER_DUST)
    ) {
      deleteNotifications([NotificationList.VAULT_UNDER_DUST]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, vaultUnderDustLimit]);

  // unmounting removes all notifications
  useEffect(
    () => () =>
      deleteNotifications([
        NotificationList.CLAIM_COLLATERAL,
        NotificationList.NON_VAULT_OWNER,
        NotificationList.VAULT_BELOW_CURRENT_PRICE,
        NotificationList.VAULT_BELOW_NEXT_PRICE,
        NotificationList.VAULT_IS_LIQUIDATED,
        NotificationList.VAULT_UNDER_DUST
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const showAction = props => {
    const emSize = parseInt(getComputedStyle(document.body).fontSize);
    const pxBreakpoint = parseInt(theme.breakpoints.l) * emSize;
    const isMobile = document.documentElement.clientWidth < pxBreakpoint;
    if (isMobile) {
      setActionShown(props);
    } else {
      showSidebar(props);
    }
  };

  const disableDeposit =
    isProxyLess || !account || emergencyShutdownActive || vaultUnderDustLimit;
  const disablePayback = isProxyLess || !account || emergencyShutdownActive;
  const disableWithdraw =
    isProxyLess ||
    !account ||
    !isOwner ||
    emergencyShutdownActive ||
    vaultUnderDustLimit;
  const disableGenerate =
    isProxyLess ||
    !account ||
    !isOwner ||
    emergencyShutdownActive ||
    totalGenerateableDai.toBigNumber().lt(debtFloor);

  return (
    <PageContentLayout>
      <Box>
        <Text.h2>
          {vaultType} {lang.cdp} #{vault.id}
        </Text.h2>
      </Box>
      <Grid
        py="m"
        gridColumnGap="l"
        gridTemplateColumns={{
          0: '1fr',
          1: '1fr',
          xl: '1fr 1fr'
        }}
      >
        <CdpViewCard title={lang.cdp_page.liquidation_price}>
          <Flex alignItems="flex-end" mt="s" mb="xs">
            <AmountDisplay
              amount={prettifyNumber(liquidationPrice, null, null, false)}
              denomination="INR"
            />
            {/* <ExtraInfo>({gem}/USD)</ExtraInfo> */}
          </Flex>
          <InfoContainerRow
            title={
              <TextBlock fontSize="l">
                {lang.cdp_page.current_price_info}
              </TextBlock>
            }
            value={`${prettifyNumber(
              vault.collateralTypePrice,
              null,
              null,
              false
            )} INR`}
          />
          <InfoContainerRow
            title={lang.cdp_page.liquidation_penalty}
            value={
              formatter(vault.liquidationPenalty, {
                percentage: true
              }) + '%'
            }
          />
        </CdpViewCard>

        <CdpViewCard title={lang.cdp_page.collateralization_ratio}>
          <Flex alignItems="flex-end" mt="s" mb="xs">
            <AmountDisplay amount={collateralizationRatio} denomination="%" />
          </Flex>
          <InfoContainerRow
            title={lang.cdp_page.minimum_ratio}
            value={
              formatter(vault.liquidationRatio, {
                percentage: true
              }) + '%'
            }
          />
          <InfoContainerRow
            title={lang.cdp_page.stability_fee}
            value={
              formatter(vault.annualStabilityFee, {
                percentage: true,
                rounding: BigNumber.ROUND_HALF_UP
              }) + '%'
            }
          />
        </CdpViewCard>

        <CdpViewCard title={`${gem} ${lang.cdp_page.locked.toLowerCase()}`}>
          <ActionContainerRow
            title={`${gem} ${lang.cdp_page.locked.toLowerCase()}`}
            value={`${prettifyNumber(
              vault.collateralAmount._amount,
              false,
              null,
              false
            )}`}
            conversion={`${prettifyNumber(vault.collateralValue)}`}
            button={
              <ActionButton
                disabled={disableDeposit}
                onClick={() => {
                  trackBtnClick('Deposit');
                  showAction({
                    type: 'deposit',
                    props: { vault }
                  });
                }}
              >
                {lang.actions.deposit}
              </ActionButton>
            }
          />
          <ActionContainerRow
            title={lang.cdp_page.able_withdraw}
            value={`${prettifyNumber(
              vault.collateralAvailableAmount._amount,
              false,
              null,
              false
            )}`}
            conversion={`${prettifyNumber(vault.collateralAvailableValue)}`}
            button={
              <ActionButton
                disabled={disableWithdraw}
                onClick={() => {
                  trackBtnClick('Withdraw');
                  showAction({
                    type: 'withdraw',
                    props: { vault }
                  });
                }}
              >
                {lang.actions.withdraw}
              </ActionButton>
            }
          />
        </CdpViewCard>

        <CdpViewCard title={lang.cdp_page.outstanding_dai_debt}>
          <ActionContainerRow
            title={lang.cdp_page.outstanding_dai_debt}
            value={`${prettifyNumber(vault.debtValue).split(" ")[0]} INRC`}
            button={
              <ActionButton
                disabled={disablePayback}
                onClick={() => {
                  trackBtnClick('Payback');
                  showAction({
                    type: 'payback',
                    props: { vault }
                  });
                }}
              >
                {lang.actions.pay_back}
              </ActionButton>
            }
          />
          <ActionContainerRow
            title={lang.cdp_page.available_generate}
            value={`${prettifyNumber(vault.debtValue).split(" ")[0]} INRC`}
            button={
              <ActionButton
                disabled={disableGenerate}
                onClick={() => {
                  trackBtnClick('Generate');
                  showAction({
                    type: 'generate',
                    props: { vault }
                  });
                }}
              >
                {lang.actions.generate}
              </ActionButton>
            }
          />
        </CdpViewCard>
      </Grid>

      {FF_VAULT_HISTORY && showVaultHistory && (
        <History
          title={lang.cdp_page.tx_history}
          rows={eventHistory}
          network={network}
          isLoading={eventHistory === null}
        />
      )}

      {actionShown && (
        <FullScreenAction {...actionShown} reset={() => setActionShown(null)} />
      )}
    </PageContentLayout>
  );
}
