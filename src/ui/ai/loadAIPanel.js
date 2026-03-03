export async function loadAIPanelClass() {
    const mod = await import('../AIPanel.js');
    return mod.AIPanel;
}
