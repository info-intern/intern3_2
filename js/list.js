/**
 * リスト編集画面の処理。予定ごとの持ち物リストを新規作成・編集する。
 */
(() => {
    const pageTitle = document.getElementById('pageTitle');
    const listNameInput = document.getElementById('listNameInput');
    const listNameError = document.getElementById('listNameError');
    const presetArea = document.getElementById('presetArea');
    const itemArea = document.getElementById('itemArea');
    const itemSelectError = document.getElementById('itemSelectError');
    const saveButton = document.getElementById('saveButton');

    // 編集対象のリストID。空文字なら新規作成
    const listId = UI.getQueryParam('listId');

    // 選択中の持ち物のコード値
    const selectedCodes = new Set();

    /**
     * 入力エラーの表示を切り替える。
     * @param {HTMLElement} element エラー文言を表示する要素
     * @param {string} message 表示する文言。空文字なら非表示
     */
    const setError = (element, message) => {
        element.textContent = message;
        element.hidden = message === '';
    };

    /**
     * ひな型のボタンを描画する。押すと、その持ち物にチェックを付ける。
     */
    const renderPresets = () => {
        UI.clear(presetArea);
        const presets = Storage.getPresets();

        if (presets.length === 0) {
            presetArea.appendChild(UI.createEmptyMessage('ひな型がありません。'));
            return;
        }

        // カテゴリごとにまとめる。JSONに書かれた並び順をそのまま保つ
        const grouped = new Map();
        presets.forEach((preset) => {
            const category = preset.category || 'その他';
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category).push(preset);
        });

        grouped.forEach((categoryPresets, category) => {
            presetArea.appendChild(UI.createElement('h3', 'preset-category', category));

            const container = UI.createElement('ul', 'card-list');
            categoryPresets.forEach((preset) => container.appendChild(createPresetRow(preset)));
            presetArea.appendChild(container);
        });
    };

    /**
     * ひな型1件を表す行を作る。押すと、その持ち物にチェックを付ける。
     * @param {Object} preset 表示するひな型
     * @returns {HTMLLIElement} 生成した行要素
     */
    const createPresetRow = (preset) => {
        const listItem = document.createElement('li');
        const row = UI.createElement('button', 'row');
        row.type = 'button';

        const body = UI.createElement('span', 'row-body');
        body.appendChild(UI.createElement('span', 'row-title', preset.name));
        body.appendChild(UI.createElement('span', 'row-note', `持ち物 ${preset.itemCodes.length}個を選択します`));
        row.appendChild(body);
        row.appendChild(UI.createElement('span', 'row-arrow', '＋'));

        row.addEventListener('click', () => {
            // 削除済みの持ち物がリストに混ざらないよう、登録されているコードだけを選ぶ
            preset.itemCodes
                .filter((code) => Storage.findItem(code))
                .forEach((code) => selectedCodes.add(code));
            if (listNameInput.value.trim() === '') {
                listNameInput.value = preset.name;
            }
            renderItems();
            setError(itemSelectError, '');
            UI.showToast(`「${preset.name}」の持ち物を選びました`);
        });

        listItem.appendChild(row);
        return listItem;
    };

    /**
     * 持ち物のチェックボックス一覧を描画する。
     */
    const renderItems = () => {
        UI.clear(itemArea);
        const items = Storage.getItems();

        if (items.length === 0) {
            itemArea.appendChild(UI.createEmptyMessage(
                '持ち物がまだ登録されていません。トップ画面の「持ち物を管理する」から登録してください。'
            ));
            return;
        }

        const container = UI.createElement('ul', 'card-list');
        items.forEach((item) => {
            const listItem = document.createElement('li');

            const label = UI.createElement('label', 'check-row');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedCodes.has(item.code);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedCodes.add(item.code);
                } else {
                    selectedCodes.delete(item.code);
                }
                setError(itemSelectError, '');
            });

            // 持ち物管理画面と同じ並びにする（名前 → 説明、コード値は右端）
            const body = UI.createElement('span', 'row-body');
            body.appendChild(UI.createElement('span', 'row-title', item.name));
            if (item.note) {
                body.appendChild(UI.createElement('span', 'row-note', item.note));
            }

            const codeLabel = UI.createElement(
                'span',
                'row-code code-value',
                item.manual ? '手動チェック' : `コード ${item.code}`
            );

            label.appendChild(checkbox);
            label.appendChild(body);
            label.appendChild(codeLabel);
            listItem.appendChild(label);
            container.appendChild(listItem);
        });
        itemArea.appendChild(container);
    };

    /**
     * 入力内容を検証して保存し、トップ画面へ戻る。
     */
    const save = () => {
        setError(listNameError, '');
        setError(itemSelectError, '');

        const name = listNameInput.value.trim();
        // 最初にエラーになった箇所。保存後にそこまでスクロールして気づけるようにする
        let firstErrorTarget = null;

        // 必須チェック・桁数チェック
        if (name === '') {
            setError(listNameError, 'リスト名を入力してください。');
            firstErrorTarget = listNameInput;
        } else if (name.length > 30) {
            setError(listNameError, 'リスト名は30文字以内で入力してください。');
            firstErrorTarget = listNameInput;
        }

        if (selectedCodes.size === 0) {
            setError(itemSelectError, '持ち物を1つ以上選んでください。');
            firstErrorTarget = firstErrorTarget || itemSelectError;
        }

        if (firstErrorTarget) {
            UI.focusError(firstErrorTarget);
            return;
        }

        Storage.saveList({ id: listId, name, itemCodes: Array.from(selectedCodes) });
        window.location.href = 'index.html';
    };

    /**
     * 画面を初期化する。編集の場合は既存の内容を読み込む。
     */
    const initialize = async () => {
        try {
            await Storage.initialize();
        } catch (error) {
            UI.showToast('初期データを読み込めませんでした');
        }

        if (listId !== '') {
            const list = Storage.findList(listId);
            if (list) {
                pageTitle.textContent = 'リストを編集する';
                document.title = 'リストを編集する | 忘れ物チェック';
                listNameInput.value = list.name;
                list.itemCodes.forEach((code) => selectedCodes.add(code));
            } else {
                UI.showToast('リストが見つかりませんでした');
            }
        }

        saveButton.addEventListener('click', save);
        renderPresets();
        renderItems();
    };

    initialize();
})();
