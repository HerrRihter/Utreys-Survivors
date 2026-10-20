// Developer tools — the bestiary's animation controls, the arena's collision outlines and the
// run journal's export — are shown only with ?dev in the address. Players never see them.
export const devToolsEnabled = (search = '') => new URLSearchParams(search).has('dev');
