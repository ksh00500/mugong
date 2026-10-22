const rows = `
시간 초과|Time limit reached|時間切れ|时间耗尽|時間耗盡
전원 연결 종료|All players disconnected|全員が切断|所有玩家断线|所有玩家斷線
유효 피해|Effective damage|有効ダメージ|有效伤害|有效傷害
받은 피해|Damage taken|受けたダメージ|承受伤害|承受傷害
다시 연결|Reconnect|再接続|重新连接|重新連線
초|s|秒|秒|秒
매칭 취소|Cancel search|マッチングを取消|取消匹配|取消配對
무승부|Draw|引き分け|平局|平手
경기 종료|Match ended|試合終了|比赛结束|比賽結束
라운드|Round|ラウンド|回合|回合
나가기|Leave|退出|离开|離開
승리|Victory|勝利|胜利|勝利
패배|Defeat|敗北|失败|失敗
항복|Surrender|降参|投降|投降
접속 종료에 실패했습니다|Could not sign out|ログアウトできませんでした|无法退出登录|無法登出
대전 준비 완료|Ready|準備完了|准备就绪|準備就緒
실시간 레이드 · 1~4인|Live raid · 1–4 players|協力レイド · 1～4人|实时团本 · 1–4人|即時團本 · 1–4人
협동 레이드|Cooperative raid|協力レイド|协作团本|協作團本
무공 · 협동 레이드|MUGONG · Cooperative raid|武功 · 協力レイド|武功 · 协作团本|武功 · 協作團本
레이드에 들어서다|Enter the raid|レイドに挑む|进入团本|進入團本
같은 온라인 계정으로 협동합니다. 로컬 여정과 자산은 그대로 보존됩니다.|Cooperate with your online account. Local journeys and belongings stay intact.|同じオンラインアカウントで協力します。ローカルの旅と資産は保持されます。|使用同一在线账户协作。本地旅程和资产保持不变。|使用同一線上帳戶協作。本機旅程與資產保持不變。
레이드 입장|Enter raid|レイドに入る|进入团本|進入團本
협동 레이드 전장|Cooperative raid battlefield|協力レイド戦場|协作团本战场|協作團本戰場
레이드 그림 준비|Preparing raid artwork|レイド画像を準備中|正在准备团本图像|正在準備團本圖像
표준 무인 1~4인 · 흑풍산채 5층 · 아군 피해 없음|Standard fighters · 1–4 players · 5 floors · No friendly fire|標準武人1～4人 · 黒風山寨5層 · 味方へのダメージなし|标准武者1–4人 · 黑风山寨5层 · 无友伤|標準武者1–4人 · 黑風山寨5層 · 無友傷
보스 체력은 층 시작 인원으로 고정됩니다. 사망한 무인은 부활하지 않습니다.|Boss HP is fixed by the party at floor start. Fallen fighters do not revive.|ボスの体力は階層開始時の人数で固定。倒れた武人は復活しません。|首领生命值按本层开始人数固定。倒下的武者不会复活。|首領生命值依本層開始人數固定。倒下的武者不會復活。
층 사이에 귀환하거나 전원 준비로 다음 층에 도전합니다. 인원이 바뀌면 준비가 취소됩니다.|Return between floors or ready together for the next floor. Party changes cancel readiness.|階層間で帰還するか、全員準備して次へ。人数変更で準備が解除されます。|层间可返回，或全员准备前往下一层。人员变化会取消准备。|層間可返回，或全員準備前往下一層。人員變動會取消準備。
전투는 일시정지되지 않습니다. 연결이 끊겨도 90초 동안 자리를 보존하며 무인은 위험에 노출됩니다.|Combat never pauses. A disconnected seat is kept for 90 seconds; the fighter remains exposed.|戦闘は止まりません。切断後90秒は席を保持しますが、武人は危険にさらされます。|战斗不会暂停。断线后保留位置90秒，武者仍面临危险。|戰鬥不會暫停。斷線後保留位置90秒，武者仍面臨危險。
표준 출전은 도전 기록만 저장합니다. 개인 무인·장비·경험치·유품 이전은 지원하지 않습니다.|Standard entry saves challenge records only. Personal fighters, gear, XP and heirloom transfers are not supported.|標準出陣は挑戦記録のみ保存。個人武人・装備・経験値・遺品の移転は未対応です。|标准出战仅保存挑战记录。不支持个人武者、装备、经验与遗物转移。|標準出戰僅儲存挑戰紀錄。不支援個人武者、裝備、經驗與遺物轉移。
레이드 기록을 불러오지 못했습니다|Could not load raid history|レイド記録を読み込めませんでした|无法加载团本记录|無法載入團本紀錄
연결을 확인한 뒤 다시 시도하세요|Check your connection and retry|接続を確認して再試行してください|请检查连接后重试|請檢查連線後重試
지금은 사용할 수 없습니다|Unavailable right now|今は使用できません|目前无法使用|目前無法使用
산채 돌파|Stronghold cleared|山寨突破|山寨突破|山寨突破
귀환 완료|Returned safely|帰還完了|返回完成|返回完成
도전 종료|Challenge ended|挑戦終了|挑战结束|挑戰結束
레이드 규칙|Raid rules|レイドのルール|团本规则|團本規則
함께 산채를 돌파|Overcome the stronghold together|共に山寨を突破|携手突破山寨|攜手突破山寨
파티 만들기|Create party|パーティー作成|创建队伍|建立隊伍
혼자 또는 최대 네 명이 함께 출전합니다.|Enter solo or with up to four players.|1人、または最大4人で出陣します。|可单人或最多四人一起出战。|可單人或最多四人一起出戰。
레이드 방 만들기|Create raid room|レイド部屋を作成|创建团本房间|建立團本房間
파티 참가|Join party|パーティーに参加|加入队伍|加入隊伍
레이드 방 참가|Join raid room|レイド部屋に参加|加入团本房间|加入團本房間
흑풍산채 경로|Blackwind route|黒風山寨の道程|黑风山寨路线|黑風山寨路線
최근 레이드|Recent raids|最近のレイド|最近团本|近期團本
아직 레이드 기록이 없습니다.|No raid history yet.|レイド記録はまだありません。|暂无团本记录。|尚無團本紀錄。
완료 층|Floors cleared|突破階層|已完成层数|已完成層數
파티 체력|Party HP|パーティー体力|队伍生命值|隊伍生命值
연결 끊김|Disconnected|切断中|连接断开|連線中斷
쓰러짐|Fallen|戦闘不能|倒下|倒下
귀환|Returned|帰還|返回|返回
참가 중|Participating|参加中|参与中|參與中
{0} 체력|{0} HP|{0}の体力|{0} 生命值|{0} 生命值
레이드 보스 체력|Raid boss HP|レイドボスの体力|团本首领生命值|團本首領生命值
흑풍산채|Blackwind stronghold|黒風山寨|黑风山寨|黑風山寨
넓게 베기|Wide cleave|広範囲斬り|大范围斩击|大範圍斬擊
부채 사격|Fan volley|扇状射撃|扇形齐射|扇形齊射
정면 방어|Frontal guard|正面防御|正面防御|正面防禦
직선 돌진|Straight charge|直線突進|直线冲锋|直線衝鋒
지면 표식|Ground marks|地面の標的|地面标记|地面標記
레이드 출전 준비|Prepare raid entry|レイド出陣準備|准备团本出战|準備團本出戰
준비 중|Preparing|準備中|准备中|準備中
빈 자리|Empty seat|空席|空位|空位
준비 취소|Cancel readiness|準備を解除|取消准备|取消準備
산채 출발|Enter stronghold|山寨へ出発|出发山寨|出發山寨
층 클리어 · 정비|Floor clear · Prepare|階層突破 · 準備|本层完成 · 整备|本層完成 · 整備
남은 인원|Remaining party|残り人数|剩余人数|剩餘人數
구성|Party revision|構成|队伍版本|隊伍版本
다음 층은 남은 전원이 다시 준비해야 출발합니다.|Everyone remaining must ready again for the next floor.|残った全員が改めて準備すると次の階層へ進みます。|剩余成员须重新全员准备后才能前往下一层。|剩餘成員須重新全員準備後才能前往下一層。
회복약|Healing potion|回復薬|恢复药|恢復藥
다음 층 준비|Ready for next floor|次の階層へ準備|准备下一层|準備下一層
지금 귀환|Return now|今すぐ帰還|立即返回|立即返回
레이드 기록 저장 중|Saving raid record|レイド記録を保存中|正在保存团本记录|正在儲存團本紀錄
쓰러짐 · 동료 관전 중|Fallen · Spectating allies|戦闘不能 · 仲間を観戦中|倒下 · 正在观战队友|倒下 · 正在觀戰隊友
이번 도전에서는 부활하지 않습니다.|No revival during this challenge.|この挑戦では復活しません。|本次挑战中不会复活。|本次挑戰中不會復活。
기록 저장 후 나가기|Leave after record saved|記録保存後に退出|保存记录后离开|儲存紀錄後離開
연결 끊김 · 다시 접속 중|Disconnected · Reconnecting|切断中 · 再接続中|连接中断 · 正在重连|連線中斷 · 正在重連
출전 포기|Abandon entry|出陣を断念|放弃出战|放棄出戰
출전 포기 확인|Confirm abandonment|断念を確認|确认放弃出战|確認放棄出戰
전투 중 포기하면 이번 무인은 쓰러짐으로 처리합니다. 층 사이에는 귀환을 이용하세요.|Abandoning combat counts this fighter as fallen. Use return between floors.|戦闘中に断念すると戦闘不能になります。階層間では帰還してください。|战斗中放弃会视为该武者倒下。层间请使用返回。|戰鬥中放棄會視為該武者倒下。層間請使用返回。
포기하고 나가기|Abandon and leave|断念して退出|放弃并离开|放棄並離開
외곽 경계|Outer perimeter|外郭警戒線|外围防线|外圍防線
죽림 경계장|Bamboo perimeter chief|竹林警備長|竹林警戒长|竹林警戒長
훈련 마당|Training yard|訓練場|训练场|訓練場
산채 사수장|Stronghold marksman|山寨射手長|山寨射手长|山寨射手長
병기고|Armory|武器庫|兵器库|兵器庫
철갑 호위장|Armored guard chief|鉄甲護衛長|铁甲护卫长|鐵甲護衛長
내원|Inner courtyard|内院|内院|內院
내원 추격자|Courtyard pursuer|内院の追跡者|内院追猎者|內院追獵者
산채 본당|Stronghold hall|山寨本堂|山寨本堂|山寨本堂
흑풍채주|Blackwind chief|黒風寨主|黑风寨主|黑風寨主
`;
export const raidMessages: Record<string, readonly [string, string, string, string]> =
  Object.fromEntries(
    rows
      .trim()
      .split('\n')
      .map((row) => {
        const [key, ...translations] = row.split('|');
        return [key, translations as [string, string, string, string]];
      }),
  );
