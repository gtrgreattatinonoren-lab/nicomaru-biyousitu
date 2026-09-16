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
  apiKey: 'AIzaSyAZQEO3Kvs62kZ_r_BeZSLMJs6z5-no1bY',
  authDomain: 'nicomaru-biyousitu.firebaseapp.com',
  projectId: 'nicomaru-biyousitu',
  storageBucket: 'nicomaru-biyousitu.firebasestorage.app',
  messagingSenderId: '746404690088',
  appId: '1:746404690088:web:59a37f7ba6d57b14816a9d'
};

// firebaseConfigがまだ書き換えられていない(初期状態の)場合はtrueを返します。
// 予約フォーム・管理画面で「設定がまだです」という案内を出すために使います。
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY' && !!firebaseConfig.apiKey;
}
