// Korean key | English | Japanese | Simplified Chinese | Traditional Chinese
const rows = `
온라인 비무 계정|Online duel account|オンライン比武アカウント|在线比武账号|線上比武帳號
실시간 1:1|Live 1v1|リアルタイム1対1|实时1对1|即時1對1
비무장에 들어서다|Enter the duel arena|比武場へ|进入比武场|進入比武場
친선 비무와 순위전. 로컬 여정과 자산은 그대로 보존됩니다.|Friendly and ranked duels. Your local journey and assets stay intact.|親善戦とランク戦。ローカルの旅と資産は保護されます。|友谊赛与排位赛。本地旅程与资产保持不变。|友誼賽與排位賽。本機旅程與資產保持不變。
온라인 로그인|Online sign in|オンラインログイン|在线登录|線上登入
온라인 계정 만들기|Create online account|オンラインアカウント作成|创建在线账号|建立線上帳號
아이디|Username|ユーザーID|用户名|使用者名稱
영문·숫자·밑줄 3~20자|3–20 letters, numbers or underscores|英数字・下線3～20文字|3至20位字母、数字或下划线|3至20位字母、數字或底線
표시 이름|Display name|表示名|显示名称|顯示名稱
비밀번호|Password|パスワード|密码|密碼
10자 이상. 다른 서비스와 다른 비밀번호를 사용하세요.|At least 10 characters. Use a unique password.|10文字以上。他のサービスと異なるパスワードを使用してください。|至少10个字符。请使用不同于其他服务的密码。|至少10個字元。請使用不同於其他服務的密碼。
접속 중|Signing in|接続中|登录中|登入中
비무장 입장|Enter arena|比武場に入る|进入比武场|進入比武場
새 온라인 계정 만들기|Create a new online account|新規オンラインアカウント|创建新在线账号|建立新線上帳號
기존 계정으로 로그인|Sign in with existing account|既存アカウントでログイン|使用已有账号登录|使用既有帳號登入
온라인 계정은 이 서버에 저장됩니다. 로컬 무인·장비는 업로드하지 않습니다.|Online accounts belong to this server. Local fighters and gear are not uploaded.|アカウントはこのサーバーに保存。ローカルの武人・装備は送信しません。|在线账号保存在此服务器，不上传本地角色和装备。|線上帳號儲存於此伺服器，不上傳本機角色與裝備。
실시간 비무 전장|Live duel battlefield|リアルタイム比武の戦場|实时比武战场|即時比武戰場
비무 그림 준비|Preparing duel artwork|比武の画像を準備中|准备比武画面|準備比武畫面
그림을 준비하지 못했습니다. 다시 준비를 눌러 주세요.|Artwork failed to load. Choose Prepare again.|画像を読み込めませんでした。「再準備」を押してください。|画面加载失败，请点击重新准备。|畫面載入失敗，請點選重新準備。
서버 표준 무인 · HP 240 · 3판 2선승 · 라운드 90초|Server presets · 240 HP · Best of three · 90-second rounds|サーバー標準武人・HP240・2本先取・各90秒|服务器标准角色·240生命·三局两胜·每局90秒|伺服器標準角色·240生命·三局兩勝·每局90秒
동시 쓰러짐은 무승부. 최대 5라운드 후 승수가 같으면 무승부입니다.|Simultaneous KOs draw. Equal wins after five rounds end the match in a draw.|同時KOは引き分け。最大5ラウンドで勝数が同じなら引き分け。|同时倒下算平局，最多5局后胜局数相同则整场平局。|同時倒下算平手，最多5局後勝局數相同則整場平手。
친선은 점수 변화 없음. 순위전은 계정 Elo 점수만 반영하며 경험치·물품 보상은 없습니다.|Friendly games do not change ratings. Ranked games change account Elo only, with no XP or item rewards.|親善戦は得点変動なし。ランク戦はアカウントEloのみ更新。経験値・物品報酬なし。|友谊赛不改积分，排位赛仅改变账号Elo，不奖励经验或物品。|友誼賽不改積分，排位賽僅改變帳號Elo，不獎勵經驗或物品。
연결이 끊겨도 전투는 계속됩니다. 30초 안에 재접속하지 않으면 패배합니다.|Combat continues after disconnect. Reconnect within 30 seconds to avoid forfeiting.|切断後も戦闘は続行。30秒以内に再接続しないと敗北します。|断线后战斗继续，30秒内未重连则判负。|斷線後戰鬥繼續，30秒內未重連則判負。
가방·약·장비 교체 없음. 설정과 설명을 열어도 상대의 전투는 멈추지 않습니다.|No bags, potions or gear changes. Menus do not pause the match.|鞄・薬・装備変更なし。メニューを開いても対戦は停止しません。|不可使用背包、药品或更换装备，打开菜单不会暂停对战。|不可使用背包、藥品或更換裝備，開啟選單不會暫停對戰。
좌클릭 공격|Left-click attack|左クリックで攻撃|左键攻击|左鍵攻擊
우클릭 궁극|Right-click ultimate|右クリックで奥義|右键奥义|右鍵奧義
무공 · 실시간 비무|MUGONG · Live duels|武功・リアルタイム比武|武功·实时比武|武功·即時比武
비무장|Duel arena|比武場|比武场|比武場
대전 규칙|Match rules|対戦ルール|对战规则|對戰規則
로그아웃|Sign out|ログアウト|退出登录|登出
비무 서버 확인 중|Checking duel server|比武サーバーを確認中|正在检查比武服务器|正在檢查比武伺服器
비무 서버에 연결하지 못했습니다|Could not connect to the duel server|比武サーバーに接続できません|无法连接比武服务器|無法連線比武伺服器
표준 무인 · 로컬 저장 보존|Standard fighters · Local save preserved|標準武人・ローカルセーブ保護|标准角色·保留本地存档|標準角色·保留本機存檔
실력으로 겨루다|Let skill decide|腕前で勝負|以实力较量|以實力較量
같은 체력과 정해진 무공으로 대전합니다. 보유 장비 차이는 반영하지 않습니다.|Fight with equal HP and preset arts. Owned gear gives no advantage.|同じHPと指定武功で対戦。所持装備の差は反映しません。|双方使用相同生命和固定武功，持有装备差异不影响比赛。|雙方使用相同生命與固定武功，持有裝備差異不影響比賽。
출전 무인 선택|Choose fighter|出場武人を選択|选择出战角色|選擇出戰角色
검객|Swordsman|剣客|剑客|劍客
암영|Shadow|暗影|暗影|暗影
기문|Mystic|奇門|奇门|奇門
회피 베기 · 반격|Evasive cut · Counter|回避斬り・反撃|闪避斩击·反击|閃避斬擊·反擊
근접 충격 · 방어|Close impact · Guard|近接衝撃・防御|近身冲击·防御|近身衝擊·防禦
독침 · 혈도 흡혈|Poison dart · Blood blade|毒針・血刀吸血|毒针·血刀吸血|毒針·血刀吸血
봉술 · 기문 부채|Staff · Mystic fan|棒術・奇門の扇|棍法·奇门扇|棍法·奇門扇
순위전 상대를 찾고 있습니다|Finding a ranked opponent|ランク戦の相手を検索中|正在寻找排位对手|正在尋找排位對手
실제 플레이어와만 매칭합니다. 봇은 참가하지 않습니다.|Only real players are matched. No bots join.|実在プレイヤーのみ。ボットは参加しません。|仅匹配真实玩家，机器人不参与。|僅配對真實玩家，機器人不參與。
친선 비무|Friendly duel|親善比武|友谊比武|友誼比武
방 코드로 초대 · 점수 변화 없음|Invite by room code · No rating change|部屋コードで招待・得点変動なし|房间码邀请·不改变积分|房間碼邀請·不改變積分
친선 방 만들기|Create friendly room|親善部屋を作成|创建友谊房间|建立友誼房間
방 코드|Room code|部屋コード|房间码|房間碼
친선 방 참가|Join friendly room|親善部屋に参加|加入友谊房间|加入友誼房間
순위전|Ranked duel|ランク戦|排位赛|排位賽
계정 점수로 매칭 · 승패는 서버에 저장|Match by account rating · Results saved on server|アカウント得点で対戦・結果はサーバー保存|按账号积分匹配·胜负保存到服务器|依帳號積分配對·勝負儲存於伺服器
순위전 찾기|Find ranked match|ランク戦を探す|寻找排位赛|尋找排位賽
비무 순위|Duel rankings|比武ランキング|比武排名|比武排名
새로고침|Refresh|更新|刷新|重新整理
첫 순위전을 마치면 순위에 표시됩니다.|Complete a ranked match to appear here.|ランク戦を終えると表示されます。|完成首场排位赛后显示排名。|完成首場排位賽後顯示排名。
최근 대전|Recent matches|最近の対戦|近期对战|近期對戰
아직 대전 기록이 없습니다.|No match history yet.|対戦記録はありません。|暂无对战记录。|暫無對戰紀錄。
서버 재시작 · 경기 무효|Server restarted · Match void|サーバー再起動・試合無効|服务器重启·比赛无效|伺服器重新啟動·比賽無效
대전 진행 중|Match in progress|対戦中|对战进行中|對戰進行中
내 경기 체력|Your match HP|自分の試合HP|我的比赛生命|我的比賽生命
상대 경기 체력|Opponent match HP|相手の試合HP|对手比赛生命|對手比賽生命
입장 대기|Awaiting players|入場待ち|等待入场|等待入場
상대 기다리는 중|Waiting for opponent|相手を待機中|等待对手|等待對手
재접속 중 · 전투는 계속됩니다|Reconnecting · Combat continues|再接続中・戦闘続行|重连中·战斗继续|重新連線中·戰鬥繼續
상대 연결 끊김 · 재접속 대기|Opponent disconnected · Awaiting return|相手が切断・再接続待ち|对手已断线·等待重连|對手已斷線·等待重新連線
양쪽이 준비하면 시작합니다|Starts when both players are ready|両者の準備で開始|双方准备后开始|雙方準備後開始
친선 방 코드|Friendly room code|親善部屋コード|友谊房间码|友誼房間碼
순위전 상대를 찾았습니다|Ranked opponent found|ランク戦の相手が見つかりました|已找到排位对手|已找到排位對手
준비 완료|Ready|準備完了|准备完成|準備完成
준비 중|Preparing|準備中|准备中|準備中
상대 준비 기다리는 중|Waiting for opponent readiness|相手の準備待ち|等待对手准备|等待對手準備
대전 준비|Ready for match|対戦準備完了|准备对战|準備對戰
다시 준비|Prepare again|再準備|重新准备|重新準備
비무 시작|Duel begins|比武開始|比武开始|比武開始
라운드 승리|Round won|ラウンド勝利|本局胜利|本局勝利
라운드 패배|Round lost|ラウンド敗北|本局失败|本局失敗
다음 라운드 준비|Preparing next round|次ラウンド準備|准备下一局|準備下一局
비무 결과|Duel result|比武結果|比武结果|比武結果
재접속 시간 초과|Reconnect time expired|再接続期限切れ|重连时间已过|重新連線時間已過
항복으로 경기 종료|Match ended by surrender|降参で終了|比赛因投降结束|比賽因投降結束
양쪽 연결 끊김 · 경기 무효|Both disconnected · Match void|両者切断・試合無効|双方断线·比赛无效|雙方斷線·比賽無效
경기가 종료되었습니다|The match has ended|試合が終了しました|比赛已结束|比賽已結束
친선 경기 · 점수 변화 없음|Friendly game · No rating change|親善戦・得点変動なし|友谊赛·积分不变|友誼賽·積分不變
서버에 결과 저장 완료|Result saved on server|結果をサーバーに保存済み|结果已保存到服务器|結果已儲存於伺服器
경기 결과 저장 중. 완료 전에는 다시 출전할 수 없습니다.|Saving result. Wait before entering another match.|結果を保存中。完了まで再出場できません。|正在保存结果，完成前无法再次出战。|正在儲存結果，完成前無法再次出戰。
로컬 무인·체력·장비는 그대로 보존되었습니다.|Local fighter, HP and gear are unchanged.|ローカル武人・HP・装備は保護されました。|本地角色、生命与装备保持不变。|本機角色、生命與裝備保持不變。
한 판 더|Rematch|もう一戦|再来一局|再來一局
대기실로|Back to lobby|待機室へ|返回大厅|返回大廳
온라인 전투는 일시정지되지 않습니다|Online combat cannot be paused|オンライン戦闘は停止しません|在线战斗不可暂停|線上戰鬥不可暫停
항복 확인|Confirm surrender|降参を確認|确认投降|確認投降
항복하면 이번 경기에 패배합니다. 로컬 무인·장비 손실은 없습니다.|Surrender loses this match. Your local fighter and gear are safe.|降参で敗北。ローカル武人・装備の損失はありません。|投降会输掉本场比赛，本地角色与装备不会损失。|投降會輸掉本場比賽，本機角色與裝備不會損失。
순위 점수에 패배가 반영됩니다.|The loss affects your ranked rating.|敗北はランク得点に反映されます。|败局会影响排位积分。|敗局會影響排位積分。
계속 싸우기|Keep fighting|戦闘を続ける|继续战斗|繼續戰鬥
항복하기|Surrender|降参する|投降|投降
실시간 비무 · 친선 / 순위전|Live duels · Friendly / Ranked|リアルタイム比武・親善／ランク|实时比武·友谊／排位|即時比武·友誼／排位
타격해서 게이지 충전|Land hits to charge|命中でゲージ充填|命中以积攒能量|命中以累積能量
아직 개방되지 않았습니다|Not unlocked yet|未開放|尚未解锁|尚未解鎖
로그인이 만료되었습니다. 다시 로그인하세요|Session expired. Sign in again.|ログイン期限切れ。再度ログインしてください。|登录已过期，请重新登录。|登入已過期，請重新登入。
다른 창에서 대전에 접속했습니다|Connected to the match in another window|別のウィンドウで対戦に接続しました|已在另一个窗口连接对战|已在另一個視窗連線對戰
연결이 끊겼습니다. 다시 연결하고 있습니다|Disconnected. Reconnecting.|切断されました。再接続中です。|连接断开，正在重连。|連線中斷，正在重新連線。
접속에 실패했습니다|Sign-in failed|接続に失敗しました|登录失败|登入失敗
아이디 또는 비밀번호를 확인하세요|Check username and password|IDとパスワードを確認してください|请检查用户名和密码|請檢查使用者名稱與密碼
이미 사용 중인 아이디입니다|Username is already taken|使用中のIDです|用户名已被使用|使用者名稱已被使用
잠시 후 다시 시도하세요|Please try again shortly|しばらくして再試行してください|请稍后重试|請稍後重試
`;
export const pvpMessages: Record<string, readonly [string, string, string, string]> =
  Object.fromEntries(
    rows
      .trim()
      .split('\n')
      .map((row) => {
        const [key, ...values] = row.split('|');
        return [key, values as [string, string, string, string]];
      }),
  );
