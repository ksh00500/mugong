const rows = `
개인 무인 1~4인 · 흑풍산채 5층 · 영구 사망|Owned fighters · 1–4 players · 5 floors · Permanent death|所有武人1～4人 · 黒風山寨5階 · 永久死亡|个人武人1–4人 · 黑风山寨5层 · 永久死亡|個人武人1–4人 · 黑風山寨5層 · 永久死亡
개인 출전은 온라인 강호에서 키운 무인을 사용합니다. 수명 만료 시 자기 물품은 창고로 돌아갑니다.|Deploy fighters trained in online Jianghu. On expiry, their items return to the warehouse.|オンライン江湖で育成した武人で出陣します。寿命満了時、自分の物品は倉庫に戻ります。|使用在线江湖培养的武人。寿命到期后自身物品返回仓库。|使用線上江湖培養的武人。壽命到期後自身物品返回倉庫。
수명 만료 · 장비 회수|Lifespan expired · Equipment recovered|寿命満了 · 装備回収|寿命到期 · 装备回收|壽命到期 · 裝備回收
서버 저장 재시도 중입니다|Retrying server save|サーバー保存を再試行中|正在重试服务器保存|正在重試伺服器儲存
다음 전투를 마치기에 수명이 부족합니다. 귀환 후 무인을 확인하세요|Not enough lifespan for the next fight. Return and check your fighter.|次の戦闘を終えるための寿命が足りません。帰還して武人を確認してください|剩余寿命不足以完成下一场战斗，请归还后检查武人|剩餘壽命不足以完成下一場戰鬥，請歸還後檢查武人
온라인 무인 육성|Online fighter training|オンライン武人育成|在线武人培养|線上武人培養
온라인 강호에 나서다|Enter the online Jianghu|オンライン江湖へ|进入在线江湖|進入線上江湖
온라인 세가에서 새 무인을 육성합니다. 로컬 세가는 별도로 보존합니다.|Train new fighters in your online family. Your local family stays separate.|オンライン世家で新しい武人を育成します。ローカル世家は別に保存されます。|在在线世家培养新武人。本地世家单独保存。|在線上世家培養新武人。本地世家獨立保存。
온라인 세가 입장|Enter online family|オンライン世家に入る|进入在线世家|進入線上世家
온라인 세가를 불러오지 못했습니다|Could not load online family|オンライン世家を読み込めませんでした|无法读取在线世家|無法讀取線上世家
온라인 세가|Online family|オンライン世家|在线世家|線上世家
개인 무인 · 서버 저장|Owned fighter · Server saved|所有武人 · サーバー保存|个人武人 · 服务器存档|個人武人 · 伺服器存檔
표준 체험|Standard trial|標準体験|标准体验|標準體驗
개인 무인 출전|Deploy owned fighter|所有武人で出陣|个人武人出战|個人武人出戰
온라인 강호 20웨이브를 완주한 무인으로 출전합니다. 사망 시 무인과 미수습 장비를 잃습니다. 로컬 무인은 이전하지 않습니다.|Deploy a fighter who completed 20 online waves. Death loses the fighter and unrecovered gear. Local fighters cannot be transferred.|オンライン江湖20波を完走した武人で出陣。死亡時は武人と未回収装備を失います。ローカル武人は移転できません。|使用通关在线江湖20波的武人。死亡失去武人和未收回装备。本地武人不可转移。|使用通關線上江湖20波的武人。死亡失去武人與未收回裝備。本地武人不可轉移。
온라인 무인 육성 · 가방 · 창고|Online training · Bag · Warehouse|オンライン育成 · 鞄 · 倉庫|在线培养 · 背包 · 仓库|線上培養 · 背包 · 倉庫
진행 중인 강호를 먼저 마치세요.|Finish your current journey first.|現在の江湖を先に終えてください。|请先完成当前江湖。|請先完成目前江湖。
출전할 개인 무인|Owned fighter to deploy|出陣する所有武人|出战的个人武人|出戰的個人武人
무인 선택|Select fighter|武人を選択|选择武人|選擇武人
등록한 온라인 무인이 없습니다.|No online fighters registered.|登録済みオンライン武人がいません。|尚无注册的在线武人。|尚無登錄的線上武人。
개인 무인 · 영구 사망 · 서버 저장|Owned fighter · Permanent death · Server saved|所有武人 · 永久死亡 · サーバー保存|个人武人 · 永久死亡 · 服务器存档|個人武人 · 永久死亡 · 伺服器存檔
소지 약 사용|Use carried medicine|所持薬を使う|使用携带药品|使用攜帶藥品
개인 무인·성장·장비와 귀환 결과를 서버에 저장했습니다.|Your fighter, growth, equipment and return result are saved on the server.|武人・成長・装備と帰還結果をサーバーに保存しました。|已在服务器保存个人武人、成长、装备和归还结果。|已在伺服器儲存個人武人、成長、裝備和歸還結果。
온라인 세가 · 성장 · 장비 확인|Online family · Growth · Equipment|オンライン世家 · 成長 · 装備確認|在线世家 · 成长 · 装备|線上世家 · 成長 · 裝備
온라인 세가 · 무인 육성|Online family · Train fighters|オンライン世家 · 武人育成|在线世家 · 武人培养|線上世家 · 武人培養
서버의 마지막 확정 결과를 다시 확인합니다. 로컬 저장은 사용하지 않습니다.|Reload the last committed server result. Local saves are not used.|サーバーの最新確定結果を再確認します。ローカル保存は使用しません。|重新确认服务器最后确定的结果。不使用本地存档。|重新確認伺服器最後確定的結果。不使用本地存檔。
온라인 서버에 연결하지 못했습니다|Could not connect to the online server|オンラインサーバーに接続できませんでした|无法连接在线服务器|無法連接線上伺服器
서버 저장 · 20웨이브 육성 · 영구 사망|Server saved · 20-wave training · Permanent death|サーバー保存 · 20波育成 · 永久死亡|服务器存档 · 20波培养 · 永久死亡|伺服器存檔 · 20波培養 · 永久死亡
온라인 메뉴|Online menu|オンラインメニュー|在线菜单|線上選單
개인 레이드|Personal raid|個人レイド|个人团本|個人團本
비무|Duel|比武|比武|比武
로컬 강호|Local Jianghu|ローカル江湖|本地江湖|本地江湖
온라인 세가 확인 중|Checking online family|オンライン世家を確認中|正在确认在线世家|正在確認線上世家
개인 무인 · 층 보상 XP·수련·전리품은 서버 저장 · 은전은 생존 귀환 시 지급|Owned fighter · Floor XP, training and loot are server saved · Silver pays on living return|所有武人 · 階層経験値・修練・戦利品はサーバー保存 · 銀銭は生還時支給|个人武人 · 层数经验、修炼和战利品由服务器保存 · 生还时发放银钱|個人武人 · 層數經驗、修煉和戰利品由伺服器保存 · 生還時發放銀錢
가방 · 장비 · 전리품|Bag · Equipment · Loot|鞄 · 装備 · 戦利品|背包 · 装备 · 战利品|背包 · 裝備 · 戰利品
유품 수습|Recover heirlooms|遺品回収|收回遗物|收回遺物
유품 · 일반 가방 공간 사용|Heirlooms · Uses general bag space|遺品 · 一般鞄の空間を使用|遗物 · 占用普通背包空间|遺物 · 佔用普通背包空間
원래 주인 창고로 전달|Delivered to original owner's warehouse|元の持ち主の倉庫に返却|已送至原主人的仓库|已送至原主人的倉庫
미수습 소실|Unrecovered and lost|未回収で消失|未收回而遗失|未收回而遺失
수습|Recover|回収|收回|收回
{0} 운반 중 · 착용 불가|Carried by {0} · Cannot equip|{0}が運搬中 · 装備不可|{0}搬运中 · 无法装备|{0}搬運中 · 無法裝備
유품 · {0}|Heirloom · {0}|遺品 · {0}|遗物 · {0}|遺物 · {0}
레이드에서는 창고를 사용할 수 없습니다|Warehouse is unavailable during raids|レイド中は倉庫を使えません|团本中不可使用仓库|團本中不可使用倉庫
성장과 전리품 수납을 마치세요|Finish growth and stow or discard loot|成長と戦利品の収納を終えてください|请先完成成长并收纳或丢弃战利品|請先完成成長並收納或丟棄戰利品
다른 창에서 온라인 세가를 열었습니다|Your online family was opened in another window|別のウィンドウでオンライン世家が開かれました|已在其他窗口打开在线世家|已在其他視窗開啟線上世家
온라인 연결이 끊겼습니다. 다시 연결하세요|Online connection lost. Reconnect.|オンライン接続が切れました。再接続してください|在线连接已断开，请重新连接|線上連線已中斷，請重新連線
서버 저장 재시도 중입니다. 진행을 보존하고 멈췄습니다|Retrying server save. Progress is preserved and paused.|サーバー保存を再試行中です。進行を保持して停止しました|正在重试服务器保存，进度已保留并暂停|正在重試伺服器儲存，進度已保留並暫停
`;
export const onlineMessages: Record<string, readonly [string, string, string, string]> =
  Object.fromEntries(
    rows
      .trim()
      .split('\n')
      .map((row) => {
        const [key, ...value] = row.split('|');
        return [key, value as [string, string, string, string]];
      }),
  );
