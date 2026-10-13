// Library from the top bar always opens fresh, as in the Xbox app: on Installed, no filters, at the top.
// (Back from a game page still returns to the exact spot; only the Library button resets.)
const gLibraryHome = 'installed';
const gTweaksPerform = performAction;
performAction = async function (action, source) {
  if (action === 'library' && source?.closest?.('.topbar')) {
    state.libraryQueue = false;
    state.gHiddenView = false;
    state.sourceFilter = 'all';
    state.collectionFilter = 'all';
    state.consoleLibraryGroups = false;
    const select = document.querySelector('#library-source-filter');
    if (select) select.value = 'all';
    const result = await gTweaksPerform(action, source);
    const tab = document.querySelector(`.console-library-nav [data-section="${CSS.escape(gLibraryHome)}"]`);
    if (tab) await performAction('console-library-section', tab);
    const main = document.querySelector('main');
    if (typeof gStopAllScrolls === 'function') gStopAllScrolls();
    main.scrollTo({ top: 0, behavior: 'instant' });
    libraryGrid.scrollTo?.({ top: 0, behavior: 'instant' });
    setFocusedElement(source, { scroll: false });
    return result;
  }
  return gTweaksPerform(action, source);
};
