/**
 * トップ画面の処理。保存済みリストの一覧を表示し、チェック・編集・複製・削除の導線を出す。
 */
(() => {
    const listArea = document.getElementById('listArea');
    const itemCountText = document.getElementById('itemCountText');

    /**
     * 1件のリストを表す行を作る。
     * @param {Object} list 表示するリスト
     * @returns {HTMLLIElement} 生成した行要素
     */
    const createListRow = (list) => {
        const listItem = document.createElement('li');

        // 行全体をタップするとチェック画面へ進む
        const link = document.createElement('a');
        link.className = 'row';
        link.href = `check.html?listId=${encodeURIComponent(list.id)}`;

        const body = UI.createElement('span', 'row-body');
        body.appendChild(UI.createElement('span', 'row-title', list.name));

        const lastCheckedAt = Storage.getLastCheckedAt(list.id);
        const noteParts = [`持ち物 ${list.itemCodes.length}個`];
        if (lastCheckedAt) {
            noteParts.push(`最終チェック ${UI.formatDateTime(lastCheckedAt)}`);
        }
        body.appendChild(UI.createElement('span', 'row-note', noteParts.join('・')));

        link.appendChild(body);
        link.appendChild(UI.createElement('span', 'row-arrow', '›'));
        listItem.appendChild(link);

        // 編集・複製・削除の操作ボタン
        const actions = UI.createElement('div', 'row-actions');

        const editButton = UI.createElement('button', 'btn btn-secondary btn-small', '編集');
        editButton.type = 'button';
        editButton.addEventListener('click', () => {
            window.location.href = `list.html?listId=${encodeURIComponent(list.id)}`;
        });

        const duplicateButton = UI.createElement('button', 'btn btn-secondary btn-small', '複製');
        duplicateButton.type = 'button';
        duplicateButton.addEventListener('click', () => {
            Storage.duplicateList(list.id);
            renderLists();
            UI.showToast('リストを複製しました');
        });

        const deleteButton = UI.createElement('button', 'btn btn-danger btn-small', '削除');
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', async () => {
            const confirmed = await UI.confirmDialog({
                title: 'このリストを削除しますか？',
                message: `「${list.name}」とチェック履歴が削除されます。この操作は元に戻せません。`,
            });
            if (confirmed) {
                Storage.removeList(list.id);
                renderLists();
                UI.showToast('リストを削除しました');
            }
        });

        actions.appendChild(editButton);
        actions.appendChild(duplicateButton);
        actions.appendChild(deleteButton);
        listItem.appendChild(actions);

        return listItem;
    };

    /**
     * 保存済みリストの一覧を描画する。
     */
    const renderLists = () => {
        UI.clear(listArea);
        const lists = Storage.getLists();

        if (lists.length === 0) {
            listArea.appendChild(UI.createEmptyMessage(
                'リストがまだありません。下のボタンから予定ごとの持ち物リストを作りましょう。'
            ));
            return;
        }

        const container = UI.createElement('ul', 'card-list');
        lists.forEach((list) => container.appendChild(createListRow(list)));
        listArea.appendChild(container);
    };

    /**
     * 登録済みの持ち物の件数を表示する。
     */
    const renderItemCount = () => {
        itemCountText.textContent = `登録済み ${Storage.getItems().length}個`;
    };

    /**
     * 画面を初期化する。初期データの読み込みは外部ファイルの取得なので失敗を捕捉する。
     */
    const initialize = async () => {
        try {
            await Storage.initialize();
        } catch (error) {
            UI.showToast('初期データを読み込めませんでした');
        }
        renderLists();
        renderItemCount();
    };

    initialize();
})();
