/**
 * 画面共通の表示部品（トースト通知・確認モーダル・要素生成）をまとめたもの。
 */
const UI = (() => {
    let toastTimerId = null;

    /**
     * 画面下部にトースト通知を表示し、数秒後に自動で消す。
     * @param {string} message 表示する文言
     */
    const showToast = (message) => {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;

        window.clearTimeout(toastTimerId);
        window.requestAnimationFrame(() => toast.classList.add('is-visible'));
        toastTimerId = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
    };

    /**
     * 確認モーダルを表示する。削除など取り消せない操作の前に使う。
     * @param {Object} options タイトル・本文・実行ボタンの文言
     * @returns {Promise<boolean>} 実行が選ばれたら true
     */
    const confirmDialog = ({ title, message, confirmLabel = '削除する', danger = true }) => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            const card = document.createElement('div');
            card.className = 'modal-card';

            const heading = document.createElement('h2');
            heading.textContent = title;
            card.appendChild(heading);

            if (message) {
                const body = document.createElement('p');
                body.textContent = message;
                card.appendChild(body);
            }

            const actions = document.createElement('div');
            actions.className = 'modal-actions';

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.textContent = 'キャンセル';

            const confirmButton = document.createElement('button');
            confirmButton.type = 'button';
            confirmButton.className = danger ? 'btn btn-danger' : 'btn btn-primary';
            confirmButton.textContent = confirmLabel;

            actions.appendChild(cancelButton);
            actions.appendChild(confirmButton);
            card.appendChild(actions);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            /**
             * モーダルを閉じて結果を返す。
             * @param {boolean} result 実行が選ばれたか
             */
            const close = (result) => {
                overlay.classList.remove('is-visible');
                window.setTimeout(() => overlay.remove(), 200);
                resolve(result);
            };

            cancelButton.addEventListener('click', () => close(false));
            confirmButton.addEventListener('click', () => close(true));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    close(false);
                }
            });

            window.requestAnimationFrame(() => overlay.classList.add('is-visible'));
        });
    };

    /**
     * 要素を生成する。テキストは textContent で設定する（XSS対策）。
     * @param {string} tagName タグ名
     * @param {string} className クラス名
     * @param {string} text 表示する文字列
     * @returns {HTMLElement} 生成した要素
     */
    const createElement = (tagName, className, text) => {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (text !== undefined && text !== null) {
            element.textContent = text;
        }
        return element;
    };

    /**
     * 「データがありません」の案内を表示する要素を作る。
     * @param {string} message 表示する文言
     * @returns {HTMLElement} 生成した要素
     */
    const createEmptyMessage = (message) => createElement('p', 'empty-message', message);

    /**
     * 要素の子をすべて取り除く。
     * @param {HTMLElement} element 対象の要素
     */
    const clear = (element) => {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    };

    /**
     * 入力エラーの箇所まで画面をスクロールし、分かるようにトーストも出す。
     * 保存ボタンが画面下部に固定されているため、上のほうでエラーが出ても気づけないのを防ぐ。
     * @param {HTMLElement} target 最初にエラーになった要素
     * @param {string} message トーストに表示する文言
     */
    const focusError = (target, message = '入力内容を確認してください') => {
        showToast(message);
        if (!target) {
            return;
        }

        // ヘッダーに隠れないよう、画面の中央に来るようスクロールする
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 入力欄の場合はカーソルも移す（スクロールは上で済ませているので邪魔しない）
        if (target.tagName === 'INPUT') {
            target.focus({ preventScroll: true });
        }
    };

    /**
     * URL のクエリパラメータを取得する。
     * @param {string} name パラメータ名
     * @returns {string} 値。無ければ空文字
     */
    const getQueryParam = (name) => new URLSearchParams(window.location.search).get(name) || '';

    /**
     * ISO形式の日時を「8/21 13:05」の形に整える。
     * @param {string} isoString ISO形式の日時
     * @returns {string} 表示用の文字列
     */
    const formatDateTime = (isoString) => {
        if (!isoString) {
            return '';
        }
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${minutes}`;
    };

    return {
        showToast,
        focusError,
        confirmDialog,
        createElement,
        createEmptyMessage,
        clear,
        getQueryParam,
        formatDateTime,
    };
})();
