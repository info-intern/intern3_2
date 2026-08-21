/**
 * 忘れ物チェック画面の処理。
 * カバンの中身を一括読み取りし、リストと照合して「足りない物」を表示する。
 */
(() => {
    const pageTitle = document.getElementById('pageTitle');
    const guideText = document.getElementById('guideText');
    const pcNotice = document.getElementById('pcNotice');
    const resultArea = document.getElementById('resultArea');
    const manualArea = document.getElementById('manualArea');
    const manualList = document.getElementById('manualList');
    const simulationArea = document.getElementById('simulationArea');
    const simulationList = document.getElementById('simulationList');
    const simulationButton = document.getElementById('simulationButton');
    const scanButton = document.getElementById('scanButton');
    const resetButton = document.getElementById('resetButton');

    const listId = UI.getQueryParam('listId');

    // チェック1回分を識別するID。再スキャンしても同じIDを使い、履歴は1件にまとめる
    const sessionId = `check-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const startedAt = Date.now();

    let targetList = null;
    // 読み取れたコード値の累積。分割してスキャンしても結果が積み上がるようにする
    const scannedCodes = new Set();
    // 手動チェックで「入れた」と確認した持ち物のコード値
    const manualCheckedCodes = new Set();
    let scanCount = 0;
    let hasScanned = false;

    /**
     * リストに含まれる持ち物のうち、コードで読み取る対象を返す。
     * @returns {Array<Object>} 持ち物の配列
     */
    const getScannableItems = () => targetList.itemCodes
        .map((code) => Storage.findItem(code))
        .filter((item) => item && item.manual !== true);

    /**
     * リストに含まれる持ち物のうち、手動でチェックする対象を返す。
     * @returns {Array<Object>} 持ち物の配列
     */
    const getManualItems = () => targetList.itemCodes
        .map((code) => Storage.findItem(code))
        .filter((item) => item && item.manual === true);

    /**
     * 読み取り結果とリストを突き合わせ、3つに分類する。
     * @returns {Object} 足りない物・揃っている物・リスト外の物
     */
    const compare = () => {
        const missing = [];
        const found = [];

        getScannableItems().forEach((item) => {
            if (scannedCodes.has(item.code)) {
                found.push(item);
            } else {
                missing.push(item);
            }
        });

        getManualItems().forEach((item) => {
            if (manualCheckedCodes.has(item.code)) {
                found.push(item);
            } else {
                missing.push(item);
            }
        });

        // リストに無いコードを読み取った場合は、問題としてではなく参考情報として扱う
        const listCodes = new Set(targetList.itemCodes);
        const extra = Array.from(scannedCodes)
            .filter((code) => !listCodes.has(code))
            .map((code) => {
                const item = Storage.findItem(code);
                return { code, name: item ? item.name : '未登録の持ち物' };
            });

        return { missing, found, extra };
    };

    /**
     * 持ち物1件を表す要素を作る。
     * @param {Object} item 表示する持ち物
     * @param {boolean} withNote メモも表示するか
     * @returns {HTMLLIElement} 生成した要素
     */
    const createResultItem = (item, withNote) => {
        const listItem = document.createElement('li');
        listItem.appendChild(document.createTextNode(item.name));
        if (withNote && item.note) {
            listItem.appendChild(UI.createElement('div', 'row-note', item.note));
        }
        return listItem;
    };

    /**
     * 「足りない物」のブロックを作る。最も目立たせる。
     * @param {Array<Object>} missing 足りない持ち物
     * @returns {HTMLElement} 生成した要素
     */
    const createMissingBlock = (missing) => {
        const block = UI.createElement('section', 'result-block result-missing');
        block.appendChild(UI.createElement('h2', 'result-heading', `あと${missing.length}つ 足りません`));

        const list = document.createElement('ul');
        missing.forEach((item) => list.appendChild(createResultItem(item, true)));
        block.appendChild(list);

        return block;
    };

    /**
     * すべて揃ったときの完了表示を作る。
     * @returns {HTMLElement} 生成した要素
     */
    const createCompleteBlock = () => {
        const block = UI.createElement('section', 'result-block result-complete');
        block.appendChild(UI.createElement('h2', 'result-heading', 'すべて揃いました'));
        block.appendChild(UI.createElement('p', '', 'いってらっしゃい！'));
        return block;
    };

    /**
     * 「揃っている物」のブロックを作る。既定では折りたたんでおく。
     * @param {Array<Object>} found 揃っている持ち物
     * @returns {HTMLElement} 生成した要素
     */
    const createFoundBlock = (found) => {
        const block = document.createElement('details');
        block.className = 'result-block result-ok';

        const summary = document.createElement('summary');
        summary.textContent = `${found.length}個 揃っています`;
        block.appendChild(summary);

        const list = document.createElement('ul');
        found.forEach((item) => list.appendChild(createResultItem(item, false)));
        block.appendChild(list);

        return block;
    };

    /**
     * 「リスト外の物」のブロックを作る。
     * リストに無い物が入っていても問題ではないため、参考情報として控えめに知らせる。
     * @param {Array<Object>} extra リストに無い持ち物
     * @returns {HTMLElement} 生成した要素
     */
    const createExtraBlock = (extra) => {
        const block = UI.createElement('section', 'result-block result-extra');
        block.appendChild(UI.createElement('h2', 'result-heading', `リストにない物も${extra.length}個入っています`));
        block.appendChild(UI.createElement('p', 'result-caption', '持っていく分には問題ありません。念のため確認してください。'));

        const list = document.createElement('ul');
        extra.forEach((entry) => {
            const listItem = document.createElement('li');
            listItem.appendChild(document.createTextNode(entry.name));
            listItem.appendChild(document.createTextNode('　'));
            listItem.appendChild(UI.createElement('span', 'code-value', `コード ${entry.code}`));
            list.appendChild(listItem);
        });
        block.appendChild(list);

        return block;
    };

    /**
     * 照合結果を描画し、履歴に記録する。
     */
    const renderResult = () => {
        UI.clear(resultArea);
        if (!hasScanned) {
            return;
        }

        const { missing, found, extra } = compare();

        if (missing.length > 0) {
            resultArea.appendChild(createMissingBlock(missing));
        } else {
            resultArea.appendChild(createCompleteBlock());
        }
        if (found.length > 0) {
            resultArea.appendChild(createFoundBlock(found));
        }
        if (extra.length > 0) {
            resultArea.appendChild(createExtraBlock(extra));
        }

        guideText.textContent = missing.length > 0
            ? '足りない物をカバンに入れて、もう一度読み取ってください。'
            : 'チェックが完了しました。';

        scanButton.textContent = 'もう一度読み取る';
        resetButton.hidden = false;

        Storage.saveCheckResult(sessionId, {
            listId: targetList.id,
            missingCount: missing.length,
            scanCount,
            durationMs: Date.now() - startedAt,
        });
    };

    /**
     * 手動チェックの持ち物一覧を描画する。
     */
    const renderManualItems = () => {
        const manualItems = getManualItems();
        if (manualItems.length === 0) {
            manualArea.hidden = true;
            return;
        }

        manualArea.hidden = false;
        UI.clear(manualList);

        const container = UI.createElement('ul', 'card-list');
        manualItems.forEach((item) => {
            const listItem = document.createElement('li');
            const label = UI.createElement('label', 'check-row');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = manualCheckedCodes.has(item.code);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    manualCheckedCodes.add(item.code);
                } else {
                    manualCheckedCodes.delete(item.code);
                }
                renderResult();
            });

            const body = UI.createElement('span', 'row-body');
            body.appendChild(UI.createElement('span', 'row-title', item.name));
            if (item.note) {
                body.appendChild(UI.createElement('span', 'row-note', item.note));
            }

            label.appendChild(checkbox);
            label.appendChild(body);
            listItem.appendChild(label);
            container.appendChild(listItem);
        });
        manualList.appendChild(container);
    };

    /**
     * PC確認用の代替UIを描画する。持ってきた物を手で選んで照合できるようにする。
     */
    const renderSimulation = () => {
        simulationArea.hidden = false;
        UI.clear(simulationList);

        const container = UI.createElement('ul', 'card-list');
        Storage.getItems()
            .filter((item) => item.manual !== true)
            .forEach((item) => {
                const listItem = document.createElement('li');
                const label = UI.createElement('label', 'check-row');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = item.code;
                checkbox.checked = scannedCodes.has(item.code);

                const body = UI.createElement('span', 'row-body');
                body.appendChild(UI.createElement('span', 'row-title', item.name));
                body.appendChild(UI.createElement('span', 'row-note', `コード ${item.code}`));

                label.appendChild(checkbox);
                label.appendChild(body);
                listItem.appendChild(label);
                container.appendChild(listItem);
            });
        simulationList.appendChild(container);
    };

    /**
     * PC確認用の代替UIで選ばれた内容を読み取り結果として扱う。
     */
    const applySimulation = () => {
        const checkboxes = simulationList.querySelectorAll('input[type="checkbox"]');
        scannedCodes.clear();
        checkboxes.forEach((checkbox) => {
            if (checkbox.checked) {
                scannedCodes.add(Storage.normalizeCode(checkbox.value));
            }
        });

        scanCount += 1;
        hasScanned = true;
        renderResult();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /**
     * カメラでカバンの中身を一括読み取りし、結果を累積して照合する。
     */
    const scan = () => {
        scanButton.disabled = true;

        Reader.scanMultiple(
            (codes) => {
                scanButton.disabled = false;
                codes.forEach((code) => scannedCodes.add(code));
                scanCount += 1;
                hasScanned = true;
                renderResult();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            (message) => {
                scanButton.disabled = false;
                UI.showToast(message);
            }
        );
    };

    /**
     * 読み取り結果を消して、最初の状態に戻す。
     */
    const reset = () => {
        scannedCodes.clear();
        manualCheckedCodes.clear();
        scanCount = 0;
        hasScanned = false;

        UI.clear(resultArea);
        guideText.textContent = 'カバンの中身を机に広げ、全体が写るように構えて読み取ってください。';
        scanButton.textContent = 'カバンの中身を読み取る';
        resetButton.hidden = true;

        renderManualItems();
        if (!Reader.isAvailable()) {
            renderSimulation();
        }
    };

    /**
     * 対象のリストが見つからないときの表示に切り替える。
     */
    const showListNotFound = () => {
        guideText.textContent = '';
        resultArea.appendChild(UI.createEmptyMessage('リストが見つかりませんでした。トップ画面から選び直してください。'));
        scanButton.disabled = true;
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

        targetList = Storage.findList(listId);
        if (!targetList) {
            showListNotFound();
            return;
        }

        pageTitle.textContent = targetList.name;
        document.title = `${targetList.name} | 忘れ物チェッカー`;

        renderManualItems();

        // IroatoReader アプリの外ではカメラが使えないため、代替UIに切り替える
        if (!Reader.isAvailable()) {
            pcNotice.hidden = false;
            scanButton.disabled = true;
            renderSimulation();
            simulationButton.addEventListener('click', applySimulation);
        } else {
            scanButton.addEventListener('click', scan);
        }

        resetButton.addEventListener('click', reset);
    };

    initialize();
})();
