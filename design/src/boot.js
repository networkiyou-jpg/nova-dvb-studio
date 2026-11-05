/* Start-up */
(function boot() {
  const v = location.hash.slice(1);
  if (VIEWS.includes(v)) S.view = v;
  if (!chById(S.player.ch)) S.player.ch = S.channels[0]?.id;
  renderAll();
  renderSkinBar();
  addEventListener('beforeunload', () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S, secretFilter)); } catch (e) { /* see load() */ } });
})();
