export function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
        menu.remove();
        document.removeEventListener('click', this.hideContextMenuHandler);
    }
}
