import Phaser from 'phaser';

const W=1920, H=1080;
const C={ink:0x201812, parchment:0xeee2c5, border:0x5b4328, red:0xb33a2f, jade:0x728b70, blue:0x6da5d8, ground:0xc9ae78, ground2:0xdbc995, bamboo:0x41533b, wood:0x62472d, gold:0xb9944b};

function style(size:number,color='#241c14',bold=false):Phaser.Types.GameObjects.Text.TextStyle{
  return {fontFamily:'Georgia, "Noto Serif KR", "Malgun Gothic", serif',fontSize:size+'px',color,fontStyle:bold?'bold':'normal'};
}

class MainScene extends Phaser.Scene{
  private player!:Phaser.GameObjects.Container;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private facing=new Phaser.Math.Vector2(1,0);
  private enemies:Phaser.GameObjects.Container[]=[];
  private martial=0;
  private martialText!:Phaser.GameObjects.Text;
  private basicText!:Phaser.GameObjects.Text;
  private cooldown=0;

  create(){
    this.drawRoom();
    this.player=this.fighter(960,560,true,1);
    [[720,350],[1160,330],[690,610],[1190,630],[980,300]].forEach(([x,y])=>{
      const e=this.fighter(x,y,false,1.08);
      this.enemies.push(e);
      const hp=this.add.graphics().setDepth(55);
      hp.fillStyle(0x1b1511,1).fillRect(x-34,y-58,68,8);
      hp.fillStyle(C.red,1).fillRect(x-32,y-56,64,4);
    });
    this.drawHud();
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,Q,E') as Record<string,Phaser.Input.Keyboard.Key>;
    this.keys.Q.on('down',()=>this.switchMartial(-1));
    this.keys.E.on('down',()=>this.switchMartial(1));
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      const d=new Phaser.Math.Vector2(p.worldX-this.player.x,p.worldY-this.player.y);
      if(d.lengthSq()>1)this.facing=d.normalize();
      this.attack();
    });
  }

  update(_t:number,dt:number){
    this.cooldown=Math.max(0,this.cooldown-dt);
    const v=new Phaser.Math.Vector2();
    if(this.keys.W.isDown)v.y--;
    if(this.keys.S.isDown)v.y++;
    if(this.keys.A.isDown)v.x--;
    if(this.keys.D.isDown)v.x++;
    if(v.lengthSq()>0){
      v.normalize(); this.facing=v.clone();
      const sp=240*dt/1000;
      this.player.x=Phaser.Math.Clamp(this.player.x+v.x*sp,340,1580);
      this.player.y=Phaser.Math.Clamp(this.player.y+v.y*sp,210,820);
    }
  }

  private drawRoom(){
    const g=this.add.graphics();
    g.fillStyle(C.ground,1).fillRect(0,0,W,H);
    g.fillStyle(C.ground2,.75).fillEllipse(960,545,1410,760);
    g.fillStyle(0xe2d1a5,.5).fillEllipse(970,530,1080,570);
    for(let i=0;i<32;i++){
      const x=60+(i*173)%1800, y=130+(i*241)%820;
      const edge=Math.abs(x-960)>560||Math.abs(y-540)>300;
      if(!edge)continue;
      g.fillStyle(C.bamboo,.9).fillRect(x,y,8,100+(i%4)*24);
      g.fillStyle(0x5d704c,.8);
      for(let j=0;j<4;j++)g.fillEllipse(x+(j%2?18:-18),y+24+j*20,44,13);
    }
    g.lineStyle(10,C.wood,1);
    g.lineBetween(90,355,510,305); g.lineBetween(1410,330,1850,380);
    for(let i=0;i<8;i++){g.lineBetween(120+i*50,330-i*6,120+i*50,385-i*6);g.lineBetween(1440+i*50,335+i*6,1440+i*50,390+i*6);}
    g.fillStyle(0x7d776c,1);
    [[290,235],[340,260],[1520,250],[1580,290],[270,760],[1610,735]].forEach(([x,y])=>g.fillEllipse(x,y,50,34));
  }

  private fighter(x:number,y:number,player:boolean,scale:number){
    const c=this.add.container(x,y).setDepth(50);
    const sh=this.add.ellipse(0,25,66,22,0x000000,.22);
    const robe=this.add.graphics();
    robe.fillStyle(player?0xeee9db:0x4a382f,1).fillTriangle(-30,24,30,24,0,-24);
    robe.fillStyle(player?0x27313a:0x251d19,1).fillRect(-15,-22,30,34);
    const head=this.add.circle(0,-37,16,player?0xe2b99a:0xb88768,1);
    const hair=this.add.circle(0,-47,18,0x151313,1);
    const sword=this.add.graphics();
    sword.lineStyle(5,0xdfe5e4,1).lineBetween(18,0,76,-18);
    sword.lineStyle(7,0x3e2c1e,1).lineBetween(10,3,25,-2);
    c.add([sh,robe,head,hair,sword]); c.setScale(scale); return c;
  }

  private panel(x:number,y:number,w:number,h:number,alpha=.95){
    const g=this.add.graphics().setDepth(200);
    g.fillStyle(C.parchment,alpha).fillRoundedRect(x,y,w,h,12);
    g.lineStyle(5,0x2b2118,1).strokeRoundedRect(x,y,w,h,12);
    g.lineStyle(2,C.gold,.85).strokeRoundedRect(x+8,y+8,w-16,h-16,9);
    return g;
  }

  private drawHud(){
    this.playerHud(); this.bossHud(); this.mapHud(); this.martialHud(); this.ultHud(); this.slotsHud();
  }

  private playerHud(){
    this.panel(28,24,490,160);
    const g=this.add.graphics().setDepth(201);
    g.fillStyle(0x261f19,1).fillCircle(95,105,58);
    g.fillStyle(0xe9e2d2,1).fillTriangle(64,122,126,122,95,58);
    g.fillStyle(0x171515,1).fillCircle(95,72,25);
    this.add.text(170,42,'청하현',style(30,'#251c14',true)).setDepth(202);
    this.add.text(170,82,'체력',style(18,'#3b3023',true)).setDepth(202);
    this.add.text(438,82,'78 / 100',style(18,'#3b3023',true)).setOrigin(1,0).setDepth(202);
    g.fillStyle(0x29241e,1).fillRect(230,86,210,16); g.fillStyle(C.red,1).fillRect(233,89,158,10);
    this.add.text(170,120,'현실 수명',style(18,'#3b3023',true)).setDepth(202);
    this.add.text(438,120,'6일 13시간',style(18,'#3b3023',true)).setOrigin(1,0).setDepth(202);
  }

  private bossHud(){
    const x=620,y=28,w=720,h=90; const g=this.add.graphics().setDepth(200);
    g.fillStyle(0x17130f,.94).fillRoundedRect(x,y,w,h,12); g.lineStyle(4,0x2a2016,1).strokeRoundedRect(x,y,w,h,12);
    this.add.text(x+w/2,y+12,'검은 매 오두머리',style(27,'#f0e7d2',true)).setOrigin(.5,0).setDepth(202);
    g.fillStyle(0x2b2018,1).fillRect(x+48,y+57,w-96,20); g.fillStyle(C.red,1).fillRect(x+52,y+61,(w-104)*.77,12);
    this.add.text(x+w-52,y+54,'1843 / 2400',style(17,'#f0e7d2',true)).setOrigin(1,0).setDepth(202);
  }

  private mapHud(){
    const x=1630,y=22,w=262,h=310; this.panel(x,y,w,h,.95);
    this.add.text(x+w/2,y+18,'청풍 고개',style(27,'#271e15',true)).setOrigin(.5,0).setDepth(202);
    this.add.text(x+w/2,y+52,'제 3 장 · 안개 낀 죽림',style(15,'#594936')).setOrigin(.5,0).setDepth(202);
    const g=this.add.graphics().setDepth(202); g.lineStyle(3,0x6b5941,1).strokeCircle(x+w/2,y+165,82); g.fillStyle(0xc1b598,.35).fillCircle(x+w/2,y+165,77);
    for(let i=0;i<6;i++)g.fillStyle(C.red,1).fillCircle(x+75+(i*31)%122,y+126+(i*41)%90,5);
    g.fillStyle(0xf7f2e7,1).fillTriangle(x+131,y+158,x+119,y+183,x+143,y+183);
    this.add.text(x+20,y+258,'고개를 넘는 자들',style(16,'#2d241a',true)).setDepth(202);
    this.add.text(x+20,y+282,'- 검은 매를 처치하라',style(14,'#46392b')).setDepth(202);
  }

  private martialHud(){
    const x=26,y=846,w=510,h=210; this.panel(x,y,w,h);
    const g=this.add.graphics().setDepth(201); g.fillStyle(0x28231f,1).fillCircle(x+92,y+105,61); g.lineStyle(6,0xeae2cf,.9).arc(x+92,y+105,44,.4,5.4,false);
    this.add.text(x+174,y+26,'현재 무공',style(18,'#4c3b29',true)).setDepth(202);
    this.martialText=this.add.text(x+174,y+58,'화산매화검법',style(30,'#211a13',true)).setDepth(202);
    this.basicText=this.add.text(x+174,y+110,'A  낙매식  →  B  회풍식',style(19,'#3b2f23',true)).setDepth(202);
    this.add.text(x+174,y+154,'Q / E 로 무공 전환',style(15,'#68563e')).setDepth(202);
  }

  private ultHud(){
    const x=650,y=960,w=650,h=88; this.panel(x,y,w,h,.95);
    const g=this.add.graphics().setDepth(202); g.fillStyle(0x152332,1).fillCircle(x+55,y+44,38); g.lineStyle(4,C.gold,1).strokeCircle(x+55,y+44,42); g.lineStyle(5,0x8fc8f5,.9).arc(x+55,y+44,26,.4,5.5,false);
    this.add.text(x+112,y+16,'궁극기 · 매화난무',style(20,'#34271b',true)).setDepth(203);
    g.fillStyle(0xb2a488,1).fillRect(x+112,y+52,415,14); g.fillStyle(C.blue,1).fillRect(x+115,y+55,280,8);
    this.add.text(x+w-24,y+46,'68 / 100',style(17,'#34271b',true)).setOrigin(1,0).setDepth(203);
  }

  private slotsHud(){
    const x=1385,y=838,w=505,h=218; this.panel(x,y,w,h);
    this.add.text(x+24,y+17,'무공 전환',style(22,'#2b2118',true)).setDepth(203);
    this.add.text(x+w-24,y+19,'Q / E',style(18,'#5a4733',true)).setOrigin(1,0).setDepth(203);
    const names=['화산','무당','소림','천마'];
    for(let i=0;i<4;i++){const sx=x+48+i*112, sy=y+86; const g=this.add.graphics().setDepth(202); g.fillStyle(i===0?0x2f261d:0x665b4b,1).fillRect(sx,sy,70,70); g.lineStyle(4,i===0?C.gold:0x8e7f68,1).strokeRect(sx,sy,70,70); g.lineStyle(5,0xe7e3da,.9).lineBetween(sx+18,sy+53,sx+53,sy+18); this.add.text(sx+35,sy-22,String(i+1),style(14,'#3b2e22',true)).setOrigin(.5).setDepth(203); this.add.text(sx+35,sy+78,names[i],style(15,'#3b2e22',true)).setOrigin(.5,0).setDepth(203);}
  }

  private attack(){
    if(this.cooldown>0)return; this.cooldown=260;
    const a=this.facing.angle(); const s=this.add.graphics().setDepth(80);
    s.lineStyle(14,0xf5f1e7,.88).arc(this.player.x,this.player.y,86,a-.72,a+.72,false);
    s.lineStyle(4,0xbfd4e7,.75).arc(this.player.x,this.player.y,98,a-.68,a+.68,false);
    this.tweens.add({targets:s,alpha:0,duration:180,onComplete:()=>s.destroy()});
  }

  private switchMartial(d:number){
    this.martial=(this.martial+d+4)%4;
    const n=['화산매화검법','무당태극검','소림금강공','천마신공'];
    const b=['A  낙매식  →  B  회풍식','A  유운검  →  B  회운검','A  나한권  →  B  진각','A  마참  →  B  혈섬'];
    this.martialText.setText(n[this.martial]); this.basicText.setText(b[this.martial]);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent:'app',
  width:W,
  height:H,
  backgroundColor:'#0a0d0b',
  scene:[MainScene],
  render:{antialias:true,pixelArt:false,roundPixels:false,powerPreference:'high-performance'},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H}
});
