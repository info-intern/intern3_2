/**
 * 持ち物管理画面の処理。持ち物マスタの登録・編集・削除を行う。
 */
(() => {
    const formTitle = document.getElementById('formTitle');
    const nameInput = document.getElementById('nameInput');
    const nameError = document.getElementById('nameError');
    const manualInput = document.getElementById('manualInput');
    const codeField = document.getElementById('codeField');
    const codeInput = document.getElementById('codeInput');
    const codeError = document.getElementById('codeError');
    const scanCodeButton = document.getElementById('scanCodeButton');
    const noteInput = document.getElementById('noteInput');
    const itemArea = document.getElementById('itemArea');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');

    // 編集中の持ち物のコード値。空文字なら新規登録
    let editingCode = '';

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
     * 入力フォームを空の状態に戻す。
     */
    const resetForm = () => {
        editingCode = '';
        nameInput.value = '';
        codeInput.value = '';
        noteInput.value = '';
        manualInput.checked = false;
        setError(nameError, '');
        setError(codeError, '');
        formTitle.textContent = '持ち物を追加する';
        saveButton.textContent = 'この持ち物を登録する';
        cancelButton.hidden = true;
        updateCodeFieldVisibility();
    };

    /**
     * 手動チェックの持ち物ではコード値の入力欄を隠す。
     */
    const updateCodeFieldVisibility = () => {
        codeField.hidden = manualInput.checked;
    };

    /**
     * 入力内容を検証する。
     * @returns {Object|null} 問題なければ保存する持ち物、問題があれば null
     */
    const validate = () => {
        setError(nameError, '');
        setError(codeError, '');

        const name = nameInput.value.trim();
        const note = noteInput.value.trim();
        const isManual = manualInput.checked;
        const code = Storage.normalizeCode(codeInput.value);
        // 最初にエラーになった箇所。保存後にそこまでスクロールして気づけるようにする
        let firstErrorTarget = null;

        // 必須チェック・桁数チェック
        if (name === '') {
            setError(nameError, '持ち物の名前を入力してください。');
            firstErrorTarget = nameInput;
        } else if (name.length > 30) {
            setError(nameError, '持ち物の名前は30文字以内で入力してください。');
            firstErrorTarget = nameInput;
        }

        if (!isManual) {
            if (code === '') {
                setError(codeError, 'カメレオンコードの値を入力するか、読み取ってください。');
                firstErrorTarget = firstErrorTarget || codeInput;
            } else if (!/^[0-9]{1,6}$/.test(code)) {
                // 型チェック：カメレオンコードの値は半角数字
                setError(codeError, 'コードの値は半角数字6桁以内で入力してください。');
                firstErrorTarget = firstErrorTarget || codeInput;
            } else {
                // 重複チェック：他の持ち物が同じコード値を使っていないか
                const duplicated = Storage.getItems().some(
                    (item) => item.code === code && item.code !== editingCode
                );
                if (duplicated) {
                    setError(codeError, 'このコードは別の持ち物で使われています。');
                    firstErrorTarget = firstErrorTarget || codeInput;
                }
            }
        }

        if (firstErrorTarget) {
            UI.focusError(firstErrorTarget);
            return null;
        }

        // 手動チェックの持ち物にはコード値の代わりに専用の識別子を割り当てる
        const finalCode = isManual
            ? (editingCode !== '' && editingCode.startsWith('manual-') ? editingCode : `manual-${Date.now()}`)
            : code;

        return { code: finalCode, name, note, manual: isManual };
    };

    /**
     * 入力内容を保存する。新規登録と編集の両方を扱う。
     */
    const save = () => {
        const item = validate();
        if (!item) {
            return;
        }

        if (editingCode === '') {
            Storage.addItem(item);
            UI.showToast('持ち物を登録しました');
        } else {
            Storage.updateItem(editingCode, item);
            UI.showToast('持ち物を更新しました');
        }

        resetForm();
        renderItems();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /**
     * 選んだ持ち物の内容をフォームに読み込み、編集状態にする。
     * @param {Object} item 編集する持ち物
     */
    const startEditing = (item) => {
        editingCode = item.code;
        nameInput.value = item.name;
        noteInput.value = item.note;
        manualInput.checked = item.manual === true;
        codeInput.value = item.manual === true ? '' : item.code;
        setError(nameError, '');
        setError(codeError, '');
        formTitle.textContent = '持ち物を編集する';
        saveButton.textContent = 'この内容で更新する';
        cancelButton.hidden = false;
        updateCodeFieldVisibility();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /**
     * 1件の持ち物を表す行を作る。
     * @param {Object} item 表示する持ち物
     * @returns {HTMLLIElement} 生成した行要素
     */
    const createItemRow = (item) => {
        const listItem = document.createElement('li');

        // 「名前 → 説明」を左に縦に並べ、コード値は行の右端に置く
        const row = UI.createElement('div', 'row row-static');
        const body = UI.createElement('span', 'row-body');
        body.appendChild(UI.createElement('span', 'row-title', item.name));
        if (item.note) {
            body.appendChild(UI.createElement('span', 'row-note row-note-below', item.note));
        }
        row.appendChild(body);

        const codeLabel = UI.createElement(
            'span',
            'row-code code-value',
            item.manual ? '手動チェック' : `コード ${item.code}`
        );
        row.appendChild(codeLabel);
        listItem.appendChild(row);

        const actions = UI.createElement('div', 'row-actions');

        const editButton = UI.createElement('button', 'btn btn-secondary btn-small', '編集');
        editButton.type = 'button';
        editButton.addEventListener('click', () => startEditing(item));

        const deleteButton = UI.createElement('button', 'btn btn-danger btn-small', '削除');
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', async () => {
            const confirmed = await UI.confirmDialog({
                title: 'この持ち物を削除しますか？',
                message: `「${item.name}」を削除すると、すべてのリストからも取り除かれます。`,
            });
            if (confirmed) {
                Storage.removeItem(item.code);
                if (editingCode === item.code) {
                    resetForm();
                }
                renderItems();
                UI.showToast('持ち物を削除しました');
            }
        });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        listItem.appendChild(actions);

        return listItem;
    };

    /**
     * 登録済みの持ち物の一覧を描画する。
     */
    const renderItems = () => {
        UI.clear(itemArea);
        const items = Storage.getItems();

        if (items.length === 0) {
            itemArea.appendChild(UI.createEmptyMessage('持ち物がまだ登録されていません。'));
            return;
        }

        const container = UI.createElement('ul', 'card-list');
        items.forEach((item) => container.appendChild(createItemRow(item)));
        itemArea.appendChild(container);
    };

    /**
     * カメラでコードを読み取り、入力欄へ反映する。
     */
    const scanCode = () => {
        if (!Reader.isAvailable()) {
            UI.showToast('読み取りは IroatoReader アプリの中でのみ使えます');
            return;
        }
        Reader.scanSingle(
            (code) => {
                codeInput.value = code;
                setError(codeError, '');
                UI.showToast(`コード「${code}」を読み取りました`);
            },
            (message) => UI.showToast(message)
        );
    };

    /**
     * 画面を初期化する。
     */
    const initialize = async () => {
        try {
            await Storage.initialize();
        } catch (error) {
            UI.showToast('初期データを読み込めませんでした');
        }

        manualInput.addEventListener('change', updateCodeFieldVisibility);
        scanCodeButton.addEventListener('click', scanCode);
        saveButton.addEventListener('click', save);
        cancelButton.addEventListener('click', resetForm);

        updateCodeFieldVisibility();
        renderItems();
    };

    initialize();
})();
