/**
 * データ保存の共通処理。
 * 初回起動時に data/items.json を LocalStorage へコピーし、以降は LocalStorage を参照する。
 */
const Storage = (() => {
    const KEY_ITEMS = 'wasuremono.items';
    const KEY_PRESETS = 'wasuremono.presets';
    const KEY_LISTS = 'wasuremono.lists';
    const KEY_HISTORY = 'wasuremono.history';
    const INITIAL_DATA_URL = 'data/items.json';

    /**
     * LocalStorage から JSON を読み出す。壊れていた場合は既定値を返す。
     * @param {string} key 保存キー
     * @param {*} fallback 読み出せなかったときに返す値
     * @returns {*} 保存されていた値
     */
    const read = (key, fallback) => {
        const raw = localStorage.getItem(key);
        if (raw === null) {
            return fallback;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    };

    /**
     * LocalStorage へ JSON として保存する。
     * @param {string} key 保存キー
     * @param {*} value 保存する値
     */
    const write = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    /**
     * コード値を必ず文字列として扱う（"1" と 1 の比較ミスを防ぐ）。
     * @param {*} code コード値
     * @returns {string} 文字列に統一したコード値
     */
    const normalizeCode = (code) => String(code === undefined || code === null ? '' : code).trim();

    /**
     * 初期データを読み込み、まだ保存されていなければ LocalStorage へコピーする。
     * 外部ファイルの取得なのでエラーハンドリングを行う。
     * @returns {Promise<void>}
     */
    const initialize = async () => {
        const hasItems = localStorage.getItem(KEY_ITEMS) !== null;
        const hasPresets = localStorage.getItem(KEY_PRESETS) !== null;
        if (hasItems && hasPresets) {
            return;
        }

        try {
            const response = await fetch(INITIAL_DATA_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`初期データの取得に失敗しました (${response.status})`);
            }
            const data = await response.json();

            if (!hasItems) {
                const items = Array.isArray(data.items) ? data.items : [];
                write(KEY_ITEMS, items.map((item) => ({
                    code: normalizeCode(item.code),
                    name: String(item.name || ''),
                    note: String(item.note || ''),
                    manual: item.manual === true,
                })));
            }
            if (!hasPresets) {
                const presets = Array.isArray(data.presets) ? data.presets : [];
                write(KEY_PRESETS, presets.map((preset) => ({
                    id: String(preset.id || ''),
                    name: String(preset.name || ''),
                    itemCodes: (preset.itemCodes || []).map(normalizeCode),
                })));
            }
        } catch (error) {
            // 初期データが読めなくても空の状態でアプリを使えるようにする
            if (!hasItems) {
                write(KEY_ITEMS, []);
            }
            if (!hasPresets) {
                write(KEY_PRESETS, []);
            }
            throw error;
        }
    };

    /**
     * 持ち物マスタをすべて取得する。
     * @returns {Array<Object>} 持ち物の配列
     */
    const getItems = () => read(KEY_ITEMS, []);

    /**
     * コード値から持ち物を1件取得する。
     * @param {string} code コード値
     * @returns {Object|undefined} 該当する持ち物
     */
    const findItem = (code) => {
        const target = normalizeCode(code);
        return getItems().find((item) => item.code === target);
    };

    /**
     * 持ち物を1件追加する。コード値の重複は呼び出し側で確認しておくこと。
     * @param {Object} item 追加する持ち物
     */
    const addItem = (item) => {
        const items = getItems();
        items.push({
            code: normalizeCode(item.code),
            name: String(item.name || ''),
            note: String(item.note || ''),
            manual: item.manual === true,
        });
        write(KEY_ITEMS, items);
    };

    /**
     * 持ち物を1件更新する。
     * @param {string} originalCode 更新前のコード値
     * @param {Object} item 更新後の内容
     */
    const updateItem = (originalCode, item) => {
        const target = normalizeCode(originalCode);
        const newCode = normalizeCode(item.code);
        const items = getItems().map((current) => {
            if (current.code !== target) {
                return current;
            }
            return {
                code: newCode,
                name: String(item.name || ''),
                note: String(item.note || ''),
                manual: item.manual === true,
            };
        });
        write(KEY_ITEMS, items);

        // コード値が変わった場合は、リスト側の参照も合わせて書き換える
        if (target !== newCode) {
            const lists = getLists().map((list) => ({
                ...list,
                itemCodes: list.itemCodes.map((code) => (code === target ? newCode : code)),
            }));
            write(KEY_LISTS, lists);
        }
    };

    /**
     * 持ち物を1件削除し、各リストからも取り除く。
     * @param {string} code 削除する持ち物のコード値
     */
    const removeItem = (code) => {
        const target = normalizeCode(code);
        write(KEY_ITEMS, getItems().filter((item) => item.code !== target));

        const lists = getLists().map((list) => ({
            ...list,
            itemCodes: list.itemCodes.filter((itemCode) => itemCode !== target),
        }));
        write(KEY_LISTS, lists);
    };

    /**
     * プリセットリスト（ひな型）を取得する。
     * @returns {Array<Object>} プリセットの配列
     */
    const getPresets = () => read(KEY_PRESETS, []);

    /**
     * 保存済みのリストをすべて取得する。新しいものが先頭に来る。
     * @returns {Array<Object>} リストの配列
     */
    const getLists = () => read(KEY_LISTS, []);

    /**
     * IDからリストを1件取得する。
     * @param {string} id リストID
     * @returns {Object|undefined} 該当するリスト
     */
    const findList = (id) => getLists().find((list) => list.id === id);

    /**
     * リストを保存する。IDが未指定なら新規作成、指定済みなら上書きする。
     * @param {Object} list 保存するリスト
     * @returns {string} 保存したリストのID
     */
    const saveList = (list) => {
        const lists = getLists();
        const itemCodes = (list.itemCodes || []).map(normalizeCode);
        const index = list.id ? lists.findIndex((current) => current.id === list.id) : -1;

        if (index >= 0) {
            lists[index] = {
                ...lists[index],
                name: String(list.name || ''),
                itemCodes,
            };
            write(KEY_LISTS, lists);
            return lists[index].id;
        }

        const newList = {
            id: `list-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: String(list.name || ''),
            itemCodes,
            createdAt: new Date().toISOString(),
        };
        lists.unshift(newList);
        write(KEY_LISTS, lists);
        return newList.id;
    };

    /**
     * リストを削除する。
     * @param {string} id 削除するリストのID
     */
    const removeList = (id) => {
        write(KEY_LISTS, getLists().filter((list) => list.id !== id));
        write(KEY_HISTORY, getHistory().filter((entry) => entry.listId !== id));
    };

    /**
     * リストを複製する。名前の末尾に「のコピー」を付ける。
     * @param {string} id 複製元のリストID
     * @returns {string|null} 作成したリストのID
     */
    const duplicateList = (id) => {
        const source = findList(id);
        if (!source) {
            return null;
        }
        return saveList({ name: `${source.name} のコピー`, itemCodes: source.itemCodes });
    };

    /**
     * チェック履歴を取得する。
     * @returns {Array<Object>} 履歴の配列
     */
    const getHistory = () => read(KEY_HISTORY, []);

    /**
     * チェック結果を履歴に記録する。成功指標（KPI）の測定に使う。
     * 同じチェック（同一 sessionId）で再スキャンした場合は、その回の記録を最新の内容で上書きする。
     * @param {string} sessionId チェック1回分を識別するID
     * @param {Object} entry 記録する内容
     */
    const saveCheckResult = (sessionId, entry) => {
        const history = getHistory();
        const record = {
            sessionId: String(sessionId),
            listId: String(entry.listId || ''),
            executedAt: new Date().toISOString(),
            missingCount: Number(entry.missingCount || 0),
            scanCount: Number(entry.scanCount || 0),
            durationMs: Number(entry.durationMs || 0),
        };

        const index = history.findIndex((current) => current.sessionId === record.sessionId);
        if (index >= 0) {
            history[index] = record;
        } else {
            history.unshift(record);
        }
        write(KEY_HISTORY, history.slice(0, 200));
    };

    /**
     * 指定リストの最後のチェック日時を取得する。
     * @param {string} listId リストID
     * @returns {string|null} ISO形式の日時
     */
    const getLastCheckedAt = (listId) => {
        const entry = getHistory().find((current) => current.listId === listId);
        return entry ? entry.executedAt : null;
    };

    return {
        initialize,
        normalizeCode,
        getItems,
        findItem,
        addItem,
        updateItem,
        removeItem,
        getPresets,
        getLists,
        findList,
        saveList,
        removeList,
        duplicateList,
        getHistory,
        saveCheckResult,
        getLastCheckedAt,
    };
})();
