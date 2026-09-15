// ==========================================================================
// Firebaseプロジェクトの接続情報
// ==========================================================================
// ここに書く値は「公開されても問題ない」情報です(Firebaseの仕組み上、
// ブラウザから見えることが前提になっています)。実際のセキュリティは
// Firestoreの「セキュリティルール」(firestore.rules)で守られています。
//
// 【設定方法】
// 1. https://console.firebase.google.com/ でプロジェクトを作成
// 2. 「プロジェクトの設定」→「全般」→ 下にスクロールして「アプリを追加」→ ウェブ(</>)を選択
// 3. 表示された firebaseConfig の中身を、そのまま下の値に置き換えてください
//
// 詳しい手順は README.md の「予約システム(Firebase連携)のセットアップ」を参照してください。
// ==========================================================================

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

// firebaseConfigがまだ書き換えられていない(初期状態の)場合はtrueを返します。
// 予約フォーム・管理画面で「設定がまだです」という案内を出すために使います。
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY' && !!firebaseConfig.apiKey;
}
