// The theme the visitor chose on the site, read from the same localStorage key
// so it carries over on the shared domain.
export const THEME_STORAGE_KEY = "aaron-theme";

export const THEME_BG_LIGHT = "#FAFAF7";
export const THEME_BG_DARK = "#0E1419";

export const themeInitScript = `
(function () {
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = systemDark ? 'dark' : 'light';
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') theme = stored;
  } catch (e) {
    // Storage blocked (privacy mode): keep the system preference, do not force light.
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
`;
