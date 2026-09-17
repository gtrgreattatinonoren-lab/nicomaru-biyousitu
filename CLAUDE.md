# プロジェクトメモ(Claude Code用)

## URL一覧ドキュメントの運用

「にこまる美容室 プロジェクトURL一覧」というGoogleドキュメントを作成済み。

- URL: https://docs.google.com/document/d/1GykUGHIwXjWD_oasx42nOj2IQNHLTaRaKZRsQSBR4IM/edit
- Google Drive ファイルID: `1GykUGHIwXjWD_oasx42nOj2IQNHLTaRaKZRsQSBR4IM`
- 内容: サイトの公開URL、GitHub/Firebaseなどの管理用URL、Googleスプレッドシート一覧を、名称・URL・説明つきでまとめたもの。
  URL欄はすべて実際にタップ・クリックできるリンク(`<a href>`)にしてある。今後作り直すときも必ずリンク化すること。
- 旧版(リンク化前): `1mutrU8Y-sXeq1NF0VCfIx1HOq2VnAftTeqJDiOnzFiI` はDrive API権限の都合で削除・リネームができなかったため、
  ユーザー自身に手動で削除してもらう必要がある。

## Claude Docs側のマスター

上記Googleドキュメントの元になっているClaude Docs(このセッション内で作成)がマスターデータ。
- Artifact URL: https://claude.ai/code/artifact/a2811258-0883-426c-afad-f02d38d79672
- こちらは中身をその場で編集できるので、URLが増えたときはまずこちらを更新し、そこからHTMLエクスポート→
  Google Driveへ新規作成、という手順で反映する。

**運用ルール(ユーザー承認済み)**: Google Drive APIの制約上、既存ファイルの中身を後から自動更新することはできない
(タイトル・移動のみ更新可能で、本文の書き換えはできない)。そのため、新しいURL(新しいページ・新しい管理画面・
新しいスプレッドシートなど)が増えた場合は、**その都度このドキュメントを最新内容で作り直し、上記と同じ内容を
説明した上でユーザーに新しいリンクを案内する**運用とする。ユーザーから依頼されなくても、URLが増える変更をした
際はこちらから提案すること。
