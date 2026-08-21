/**
 * データ保存の共通処理。
 * 初回起動時に data/items.json を LocalStorage へコピーし、以降は LocalStorage を参照する。
 */
const Storage = (() => {
    const KEY_ITEMS = 'wasuremono.items';
    const KEY_PRESETS = 'wasuremono.presets';
    const KEY_LISTS = 'wasuremono.lists';
    const KEY_HISTORY = 'wasuremono.history';
    const KEY_VERSION = 'wasuremono.dataVersion';
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
     * 初期データの持ち物を、保存する形に整える。
     * @param {Array<Object>} rawItems JSONから読み込んだ持ち物
     * @returns {Array<Object>} 整えた持ち物の配列
     */
    const normalizeInitialItems = (rawItems) => (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
        code: normalizeCode(item.code),
        name: String(item.name || ''),
        note: String(item.note || ''),
        manual: item.manual === true,
    }));

    /**
     * 初期データのひな型を、保存する形に整える。
     * @param {Array<Object>} rawPresets JSONから読み込んだひな型
     * @returns {Array<Object>} 整えたひな型の配列
     */
    const normalizeInitialPresets = (rawPresets) => (Array.isArray(rawPresets) ? rawPresets : []).map((preset) => ({
        id: String(preset.id || ''),
        category: String(preset.category || 'その他'),
        name: String(preset.name || ''),
        itemCodes: (preset.itemCodes || []).map(normalizeCode),
    }));

    /**
     * 保存済みのデータに、まだ無いものだけを追加する。
     * すでにある項目は上書きせず、ユーザーが編集した内容を残す。
     * @param {Array<Object>} saved 保存済みの配列
     * @param {Array<Object>} incoming 追加したい配列
     * @param {string} keyName 重複判定に使うプロパティ名
     * @returns {Array<Object>} 追加後の配列
     */
    const mergeMissing = (saved, incoming, keyName) => {
        const existingKeys = new Set(saved.map((entry) => entry[keyName]));
        const added = incoming.filter((entry) => !existingKeys.has(entry[keyName]));
        return saved.concat(added);
    };

    /**
     * 初期データを読み込んで LocalStorage へ反映する。
     * ・未使用の端末：初期データをそのままコピーする
     * ・使用中の端末：data/items.json のバージョンが上がっていれば、まだ無いものだけを追加する
     * ・バージョン管理を始める前のデータ：コード値の割り当てが変わったため、初期データで入れ替える
     * 外部ファイルの取得なのでエラーハンドリングを行う。
     * @returns {Promise<void>}
     */
    const initialize = async () => {
        const hasItems = localStorage.getItem(KEY_ITEMS) !== null;
        const hasPresets = localStorage.getItem(KEY_PRESETS) !== null;
        const savedVersion = Number(read(KEY_VERSION, 0));

        let data = null;
        try {
            const response = await fetch(INITIAL_DATA_URL, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`初期データの取得に失敗しました (${response.status})`);
            }
            data = await response.json();
        } catch (error) {
            // 初期データが読めなくても、保存済みのデータでアプリを使えるようにする
            if (!hasItems) {
                write(KEY_ITEMS, []);
            }
            if (!hasPresets) {
                write(KEY_PRESETS, []);
            }
            throw error;
        }

        const version = Number(data.version || 1);
        const items = normalizeInitialItems(data.items);
        const presets = normalizeInitialPresets(data.presets);

        // バージョンを持たない古いデータは、コード値の意味が変わっているため入れ替える
        const isLegacyData = savedVersion === 0;

        if (!hasItems || isLegacyData) {
            write(KEY_ITEMS, items);
        } else if (version > savedVersion) {
            write(KEY_ITEMS, mergeMissing(getItems(), items, 'code'));
        }

        if (!hasPresets || isLegacyData) {
            write(KEY_PRESETS, presets);
        } else if (version > savedVersion) {
            write(KEY_PRESETS, mergeMissing(getPresets(), presets, 'id'));
        }

        write(KEY_VERSION, version);
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
