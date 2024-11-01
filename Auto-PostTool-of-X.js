const CLIENT_ID = '{CLIENT_ID}'
const CLIENT_SECRET = '{CLIENT_SECRET}'

/**
 * Twitter APIに接続するためのOAuth2サービスを設定し、返します。
 * この関数は、認証プロセスに必要な各種パラメータを含むサービスオブジェクトを作成します。
 */
function getService()
{
    pkceChallengeVerifier(); // PKCE認証フローのためのコードチャレンジと検証値を生成

    const userProps = PropertiesService.getUserProperties(); // ユーザーのプロパティを取得
    const scriptProps = PropertiesService.getScriptProperties(); // スクリプトのプロパティを取得

    // OAuth2サービスの設定
    return OAuth2.createService('twitter')
        .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize') // 認証ベースURLの設定
        .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + userProps.getProperty("code_verifier")) // トークンURLの設定
        .setClientId(CLIENT_ID) // クライアントIDの設定
        .setClientSecret(CLIENT_SECRET) // クライアントシークレットの設定
        .setCallbackFunction('authCallback') // コールバック関数の設定
        .setPropertyStore(userProps) // プロパティストアの設定
        .setScope('users.read tweet.read tweet.write offline.access') // 必要なスコープの設定
        .setParam('response_type', 'code') // レスポンスタイプの設定
        .setParam('code_challenge_method', 'S256') // コードチャレンジメソッドの設定
        .setParam('code_challenge', userProps.getProperty("code_challenge")) // コードチャレンジの設定
        .setTokenHeaders(
            {
            'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET), // トークンヘッダーの設定
            'Content-Type': 'application/x-www-form-urlencoded'
            })
}

/**
 * OAuth2認証プロセスの一環として、認証後に呼び出される関数です。
 * この関数は、認証が成功したかどうかをチェックし、適切な応答を返します。
 */
function authCallback(request)
{
    const service = getService(); // OAuth2サービスの取得
    const authorized = service.handleCallback(request); // 認証リクエストのハンドリング

    // 認証が成功した場合の処理
    if (authorized)
        return HtmlService.createHtmlOutput('Success!'); // 認証成功のメッセージを表示
    else
        return HtmlService.createHtmlOutput('Denied.'); // 認証失敗のメッセージを表示
}



/**
 * PKCE認証フローに必要なコードチャレンジとコード検証値を生成します。
 * この関数は、セキュリティを強化するためにOAuth2フローにおいて使用されます。
 */
function pkceChallengeVerifier()
{
    var userProps = PropertiesService.getUserProperties();
    if (!userProps.getProperty("code_verifier"))
        {
        var verifier = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

        // コード検証値の生成
        for (var i = 0; i < 128; i++)
            verifier += possible.charAt(Math.floor(Math.random() * possible.length));


        // コードチャレンジの生成
        var sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier)

        var challenge = Utilities.base64Encode(sha256Hash)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        userProps.setProperty("code_verifier", verifier)
        userProps.setProperty("code_challenge", challenge)
        }
}


/**
 * OAuth2認証プロセスに使用されるリダイレクトURIをログに記録します。
 * このURIは、Twitterの認証ページから戻る際に使用されます。
 */
function logRedirectUri()
{
    var service = getService(); // OAuth2サービスの取得
    Logger.log(service.getRedirectUri()); // リダイレクトURIをログに出力
}

/**
 * スクリプトのメイン関数で、OAuth2サービスの状態をチェックし、
 * 必要に応じて認証URLをログに出力します。
 */
function main()
{
    const service = getService(); // OAuth2サービスの取得

    if (service.hasAccess())
        Logger.log("Already authorized"); // すでに認証済みの場合のログ出力
    else
        {
        const authorizationUrl = service.getAuthorizationUrl(); // 認証URLの取得
        Logger.log('Open the following URL and re-run the script: %s', authorizationUrl); // 認証URLのログ出力
        }
}


/**
 * Googleスプレッドシートから予約データを取得します。
 * この関数は、スプレッドシートの全データを読み込み、それを返します。
 */

function getSpreadsheetData()
{
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("予約"); // スプレッドシートの取得
    const range = sheet.getDataRange(); // データ範囲の取得
    return range.getValues(); // データの取得
}


/**
 * Googleスプレッドシートから写真リンクデータを取得します。
 * この関数は、スプレッドシートの全データを読み込み、それを返します。
 */
function getSpreadsheetData_Rinks()
{
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("写真リンク"); // スプレッドシートの取得
    const range = sheet.getDataRange(); // データ範囲の取得
    return range.getValues(); // データの取得
}

/**
 * スケジュールされたツイートを投稿します。
 * この関数は、指定された時間にツイートを自動的に投稿するために使用されます。
 */
function postScheduledTweets()
{
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("予約"); // スプレッドシートの取得
    const rows = sheet.getDataRange().getValues(); // 全行のデータを取得
    const Rinks = getSpreadsheetData_Rinks();

    const now = new Date(); // 現在の日時を取得

    // 各行に対する処理
    for (let i = 1; i < rows.length; i++)
        {
        const [scheduledTime, tweetContent, status] = rows[i]; // 各列のデータを取得

        // スケジュールされた時間が現在時刻以前で、ツイート内容があり、まだ投稿されていない場合
        if (scheduledTime && tweetContent && new Date(scheduledTime) <= now && status !== "投稿済")
            {
            sendTweet(tweetContent); // ツイートを送信
            sheet.getRange(i + 1, 3).setValue("投稿済"); // ステータスを「投稿済み」に更新

            // ランダムに未投稿も含めたすべての予約から選んで新しい予約を作成
            const randomTweet = getRandomTweetContent(Rinks); // ランダムなツイート内容を取得
            scheduleTweetForFuture(scheduledTime, randomTweet); // 新しい予約を作成
            }
        }
}

/**
 * ランダムにツイート内容を取得する関数
 * @param {Object} Rinks - スプレッドシートオブジェクト
 * @returns {string} allRinks - ランダムに選ばれたツイート内容
 */
function getRandomTweetContent(Rinks)
{
    const rows = Rinks.getDataRange().getValues(); // スプレッドシートの全データを取得
    const allRinks = []; // すべてのリンクを格納する配列

    // 各行をループして、リンクを収集
    for (let i = 1; i < rows.length; i++)
        {
        const [Num, Name, Rink] = rows[i];

        // リンクがあればすべてリストに追加
        if (Rink)
            allRinks.push(Rink); // リンクをリストに追加
        }

    // ランダムなインデックスを生成してリンクを選ぶ
    const randomIndex = Math.floor(Math.random() * allRinks.length);

    // ランダムに選ばれたリンクを返す
    return allRinks[randomIndex];
}

/**
 * 14年後にランダムで選んだツイートを予約する関数
 * @param {string} scheduledTime - 元のスケジュール時間
 * @param {string} Rink - リンク詳細
 */
function scheduleTweetForFuture(scheduledTime, Rink)
{
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("予約"); // スプレッドシートの取得

    // 14年後の日時を計算
    const futureDate = new Date(scheduledTime); // 元のスケジュール時間をDateオブジェクトに変換
    futureDate.setFullYear(futureDate.getFullYear() + 14); // 14年を加算

    // スプレッドシートに新しい予約を追加
    const newRow = [futureDate, "チャレラ！開けロイト市警だ！"+Rink, ""];
    sheet.appendRow(newRow); // 新しい行を追加
}



/**
 * 指定された内容でツイートを送信します。
 * この関数は、Twitter APIを使用してツイートを投稿します。
 */
function sendTweet(tweetContent)
{
    if (!tweetContent)
        {
        Logger.log("No tweet content provided"); // ツイート内容がない場合のログ出力
        return;
        }

    var service = getService(); // OAuth2サービスの取得

    if (service.hasAccess())
        {
        var url = 'https://api.twitter.com/2/tweets'; // Twitter APIのURL
        var response = UrlFetchApp.fetch(url,
            {
            method: 'POST', // POSTリクエスト
            contentType: 'application/json', // コンテンツタイプ
            headers: {Authorization: 'Bearer ' + service.getAccessToken()}, // 認証ヘッダー
            muteHttpExceptions: true,
            payload: JSON.stringify({ text: tweetContent }) // ツイート内容をJSON形式で送信
            });

        var result = JSON.parse(response.getContentText()); // レスポンスの解析
        Logger.log(JSON.stringify(result, null, 2)); // レスポンスのログ出力
        }
    else
        {
        var authorizationUrl = service.getAuthorizationUrl(); // 認証URLの取得
        Logger.log('Open the following URL and re-run the script: %s', authorizationUrl); // 認証URLのログ出力
        }
}


/**
 * 指定した時間にツイートを送信するためのトリガーを作成します。
 * この関数では、翌日の19:30に予約がされます。
 */
function createTrigger()
{
    var allTriggers = ScriptApp.getProjectTriggers();
    var existingTrigger = null;

    // すでに存在するcreateTriggerトリガーを探す
    for (var i = 0; i < allTriggers.length; i++)
        {
        if (allTriggers[i].getHandlerFunction() === 'createTrigger')
            {
            existingTrigger = allTriggers[i];
            break;
            }
        }

    // すでに存在するトリガーがあれば削除
    if (existingTrigger !== null)
        ScriptApp.deleteTrigger(existingTrigger);

    postScheduledTweets();

    // 新しいトリガーを作成
    var triggerDay = new Date();
    triggerDay.setDate(triggerDay.getDate() + 1);
    triggerDay.setHours(19);
    triggerDay.setMinutes(30);
    triggerDay.setSeconds(0);

    ScriptApp.newTrigger('createTrigger')
        .timeBased()
        .at(triggerDay)
        .create();

    // トリガー設定日時を記録
    var scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('TriggerSetAt', triggerDay.toString());
}

/**
 * 以下テスト用関数
 * それぞれを直接実行することで、動作ログを確認できます。
 */

function testScheduleTweetForFuture()
{
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("予約"); // スプレッドシートの取得
    const testDate = new Date(); // テスト用の現在の日時を取得
    testDate.setFullYear(testDate.getFullYear() + 14); // 14年を加算

    // テスト用のリンク内容（ここで仮のリンクを指定）
    const testRink = "https://example.com/test";

    // 新しい行の内容をスプレッドシートに追加
    const newRow = [testDate, "チャレラ！開けロイト市警だ！" + testRink, ""];
    sheet.appendRow(newRow); // 新しい行を追加
}

function testGetRandomTweetContent()
{
    // 「写真リンク」シートのオブジェクトを取得
    const Rinks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("写真リンク");

    // シートが存在するか確認
    if (!Rinks)
        {
        Logger.log("写真リンクシートが見つかりません");
        return;
        }

    // ランダムなリンクを取得
    const randomContent = getRandomTweetContent(Rinks);

    // ログに出力
    Logger.log("取得したランダムリンク: " + randomContent);
}
