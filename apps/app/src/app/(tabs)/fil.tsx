import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';

export default function Screen() {
  const { t } = useTranslation();
  return <ComingSoon title={t('tabs.feed')} body={t('soon.feed')} />;
}
