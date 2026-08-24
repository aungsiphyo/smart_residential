const darkProfileTheme = {
  mode: 'dark',
  background: '#05080A',
  surface: '#080C0F',
  card: '#0E1316',
  raised: '#13181C',
  primary: '#F5AD27',
  primaryBg: '#2B1D06',
  primaryText: '#171006',
  text: '#F5F3EF',
  subtext: '#AAA39D',
  border: '#30363A',
  goldBorder: 'rgba(245, 173, 39, 0.68)',
  iconSurface: 'rgba(245, 173, 39, 0.09)',
  input: '#090E11',
  tabBar: '#080C0F',
  tabBarBorder: '#2A2E31',
  inactive: '#716D69',
  icon: '#DED9D2',
  switchOff: '#3B4044',
  shadow: '#000000',
  statusBar: 'light-content',
};

const lightProfileTheme = {
  mode: 'light',
  background: '#F7F2E8',
  surface: '#FFFCF6',
  card: '#FFFDF9',
  raised: '#F4ECDF',
  primary: '#B87508',
  primaryBg: '#F6E8C6',
  primaryText: '#FFFFFF',
  text: '#231B13',
  subtext: '#766B60',
  border: '#DED3C4',
  goldBorder: 'rgba(184, 117, 8, 0.56)',
  iconSurface: 'rgba(184, 117, 8, 0.09)',
  input: '#F8F1E7',
  tabBar: '#FFFCF6',
  tabBarBorder: '#E4D7BF',
  inactive: '#9A8E80',
  icon: '#3B3026',
  switchOff: '#CFC4B5',
  shadow: '#8A7351',
  statusBar: 'dark-content',
};

export function getProfileTheme(appTheme) {
  const profileTheme =
    appTheme.mode === 'dark' ? darkProfileTheme : lightProfileTheme;

  return {
    ...profileTheme,
    danger: appTheme.danger,
    dangerBg: appTheme.dangerBg,
    success: appTheme.success,
    successBg: appTheme.successBg,
    warning: appTheme.warning,
    warningBg: appTheme.warningBg,
  };
}
