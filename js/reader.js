/**
 * IroatoReader API を使ったカメレオンコード読み取りの共通処理。
 * IroatoReader アプリのアプリ内ブラウザでのみ動作する。
 */
const Reader = (() => {
    /**
     * 読み取り機能が使えるかどうかを判定する。
     * PC のブラウザや通常の Safari では IroatoReader が存在しない。
     * @returns {boolean} 使える場合は true
     */
    const isAvailable = () => typeof IroatoReader !== 'undefined';

    /**
     * カバンの中身をまとめて読み取る（複数読み取り）。
     * searchCodes は指定しない。リスト外のコードも受け取り、照合は JavaScript 側で行う。
     * @param {Function} onResult 読み取ったコード値の配列を受け取る関数
     * @param {Function} onError 読み取りに失敗したときに呼ばれる関数
     */
    const scanMultiple = (onResult, onError) => {
        const reader = new IroatoReader('cc', {
            mode: IroatoReader.multi,
            resolution: IroatoReader.r1920x1080,
            analyzeLevel: 5,
            labelText: 'カバンの中身が全体が写るように構えてください',
            buttonText: '読み取り完了',
        });

        reader.read((res) => {
            // 成否を確認してから読み取り結果を参照する
            if (!res || res.status !== true) {
                onError('読み取りに失敗しました。明るい場所で、もう一度お試しください。');
                return;
            }
            const codes = (res.data && res.data.codes) || [];
            onResult(codes.map((entry) => Storage.normalizeCode(entry.code)));
        });
    };

    /**
     * 持ち物の登録用にコードを1つだけ読み取る。
     * @param {Function} onResult 読み取ったコード値を受け取る関数
     * @param {Function} onError 読み取りに失敗したときに呼ばれる関数
     */
    const scanSingle = (onResult, onError) => {
        const reader = new IroatoReader('cc', {
            mode: IroatoReader.single,
            resolution: IroatoReader.r1920x1080,
            analyzeLevel: 5,
            labelText: '登録したい持ち物のコードを読み取ってください',
            buttonText: '読み取り完了',
        });

        reader.read((res) => {
            if (!res || res.status !== true) {
                onError('読み取りに失敗しました。もう一度お試しください。');
                return;
            }
            const codes = (res.data && res.data.codes) || [];
            if (codes.length === 0) {
                onError('コードを読み取れませんでした。');
                return;
            }
            onResult(Storage.normalizeCode(codes[0].code));
        });
    };

    return {
        isAvailable,
        scanMultiple,
        scanSingle,
    };
})();
