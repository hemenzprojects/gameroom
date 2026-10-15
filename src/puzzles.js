// Puzzle bank. Server-only: answers and hints never ship to the browser until earned.
'use strict';
const T=(t,x,y,s=48,o={})=>({k:'t',t,x,y,s,...o});
const L=(x1,y1,x2,y2)=>({k:'l',x1,y1,x2,y2});
const R=(x,y,w,h)=>({k:'r',x,y,w,h});
const P=d=>({k:'p',d});
const isEmoji=s=>/\p{Extended_Pictographic}/u.test(s);
const eqSize=s=>isEmoji(s)?76:s.length<=2?66:s.length<=5?46:36;
const eq=(a,b)=>[T(a,72,150,eqSize(a)),T('+',150,146,44),T(b,228,150,eqSize(b))];

const EASY=[
  {e:eq('🐝','lieve'),a:['believe'],h:'A buzzing insect, then the rest of the word.'},
  {e:eq('T','🌧️'),a:['train'],h:'A letter plus some weather. All aboard.'},
  {e:eq('🔥','fly'),a:['firefly'],h:'It glows on summer nights.'},
  {e:eq('⭐','🐟'),a:['starfish'],h:'Lives in rock pools and has five arms.'},
  {e:eq('☀️','🌼'),a:['sunflower'],h:'A tall yellow plant that turns toward the light.'},
  {e:eq('🦶','⚽'),a:['football'],h:'Name each picture with one simple word.'},
  {e:eq('✋','👜'),a:['handbag'],h:'Name each picture with one simple word.'},
  {e:eq('🌧️','🎀'),a:['rainbow'],h:'You see it after a shower.'},
  {e:eq('🐄','👦'),a:['cowboy'],h:'Wears a hat and rides a horse.'},
  {e:eq('🧈','🪰'),a:['butterfly'],h:'It starts life as a caterpillar.'},
  {e:eq('🦷','🖌️'),a:['toothbrush'],h:'You use it twice a day.'},
  {e:eq('🌙','💡'),a:['moonlight'],h:'What lights the night.'},
  {e:eq('🥚','plant'),a:['eggplant','aubergine'],h:'A purple vegetable.'},
  {e:eq('🐱','🐟'),a:['catfish'],h:'A fish with whiskers.'},
  {e:eq('👁️','🏝️'),a:['island'],h:'Say the first picture as a single letter sound.'},
  {e:eq('🐝','🍃'),a:['belief'],h:'Insect sound plus a plant part. Something you hold true.'},
  {e:eq('🌽','🐶'),a:['corndog','corn dog'],h:'Fairground food on a stick.'},
  {e:eq('☀️','👓'),a:['sunglasses','sunglass'],h:'You wear them on a bright day.'},
  {e:eq('🌙','🚶'),a:['moonwalk','moon walk'],h:'A famous dance move, or a step on the moon.'},
  {e:eq('❄️','👨'),a:['snowman','snow man'],h:'Built in winter with a carrot nose.'},
  {e:eq('🌧️','🧥'),a:['raincoat','rain coat'],h:'Keeps you dry.'},
  {e:eq('🍯','🌙'),a:['honeymoon','honey moon'],h:'The trip after a wedding.'},
  {e:eq('💡','🏠'),a:['lighthouse','light house'],h:'It guides ships at night.'},
  {e:eq('💧','🍈'),a:['watermelon','water melon'],h:'A big green fruit, red inside.'},
  {e:eq('🍳','🎂'),a:['pancake','pancakes'],h:'Breakfast, flipped in the air.'},
  {e:[T('🔑',62,150,70),T('+',120,146,40),T('board',204,150,40)],a:['keyboard','key board'],h:'You are probably near one now.'},
];

const MEDIUM=[
  {e:[P('M70 40 V248 H252'),T('B',112,92,54),T('O',112,160,54),T('W',182,214,54)],a:['elbow'],h:'Say the big letter, then what sits inside it. A joint in your arm.'},
  {e:[T('MAN',150,112,62),T('BOARD',150,200,62)],a:['man overboard'],h:'Shouted on a ship when someone falls in.'},
  {e:[T('STAND',150,112,60),T('I',150,200,68)],a:['i understand','understand'],h:'Look at where the letter is.'},
  {e:[T('HEAD',150,112,60),T('HEELS',150,200,60)],a:['head over heels'],h:'How you feel when madly in love.'},
  {e:[T('DICE',84,150,50),T('DICE',216,150,50)],a:['paradise','pair of dice'],h:'Two of something is a ___. A perfect place.'},
  {e:[T('CYCLE',150,88,48),T('CYCLE',150,152,48),T('CYCLE',150,216,48)],a:['tricycle'],h:'Count them. A small child rides one.'},
  {e:[T('WEAR',150,112,60),T('LONG',150,200,60)],a:['long underwear','long johns'],h:'Read what is under what. Winter clothing.'},
  {e:[T('ECNALG',150,150,58)],a:['backward glance','backwards glance','glance backward','glance back'],h:'Read it the other way round.'},
  {e:[T('T',130,58,50),T('O',130,114,50),T('W',130,170,50),T('N',130,226,50),P('M210 60 V230 M190 205 L210 232 L230 205')],a:['downtown'],h:'Which way is the town going?'},
  {e:[T('AGE',150,88,52),T('AGE',150,152,52,{deco:'u'}),T('AGE',150,216,52)],a:['middle age','middle aged'],h:'Look at the one that stands out. Somewhere around 45.'},
  {e:[T('GROUND',150,74,50),L(48,106,252,106),T('FEET',82,158,30),T('FEET',150,158,30),T('FEET',218,158,30),T('FEET',82,212,30),T('FEET',150,212,30),T('FEET',218,212,30)],a:['six feet underground','six feet under','6 feet under','6 feet underground'],h:'Count the feet. Where they are matters.'},
  {e:[T('LE',100,140,64,{r:-10}),T('VEL',206,168,64,{r:8})],a:['split level','splitlevel'],h:'The word is broken in two. A kind of house.'},
  {e:[T('ONCE',150,112,60),T('TIME',150,200,60)],a:['once upon a time'],h:'How fairy tales begin.'},
  {e:[T('KCAB',82,150,42),T('BACK',218,150,42)],a:['back to back','back-to-back'],h:'One of them is facing the other way.'},
  {e:[T('SIDE',84,150,50),T('SIDE',216,150,50)],a:['side by side'],h:'Where are they standing?'},
  {e:[T('WORKED',150,112,52),T('PAID',150,200,56)],a:['overworked and underpaid','overworked underpaid','underpaid and overworked'],h:'How many staff feel at the end of the month.'},
  {e:[T('SEARCH',150,56,40),T('SEARCH',150,248,40)],a:['search high and low','searching high and low'],h:'Look at where each word sits.'},
  {e:[T('LOOK',84,150,48),T('LEAP',216,150,48)],a:['look before you leap','look before leaping'],h:'Think first. Which word comes first?'},
];

const HARD=[
  {e:[T('HIJKLMNO',150,150,44,{ls:2})],a:['water','h2o'],h:'The letters run from H to O.'},
  {e:[T('G',86,138,68,{r:-22}),T('S',138,176,68,{r:16}),T('E',186,124,68,{r:-30}),T('G',230,176,68,{r:26})],a:['scrambled eggs','scrambled egg'],h:'A breakfast, mixed up.'},
  {e:[T('NOON',84,150,48),T('GOOD',216,150,48)],a:['good afternoon'],h:'A greeting. Where is GOOD?'},
  {e:[R(66,100,168,100),T('SAND',150,150,50)],a:['sandbox','sandpit','sand box'],h:'Where kids dig at the park.'},
  {e:[R(36,100,118,100),T('THINK',228,150,40)],a:['think outside the box','thinking outside the box'],h:'Creative advice from every workshop.'},
  {e:[L(36,108,264,108),T('READING',150,150,48),L(36,192,264,192)],a:['reading between the lines','read between the lines'],h:'Finding the hidden meaning.'},
  {e:[T('XQQME',150,150,58)],a:['excuse me'],h:'Say each letter out loud, quickly.'},
  {e:[T('WEATHER',150,112,48),T('FEELING',150,200,48)],a:['feeling under the weather','under the weather'],h:'Not quite sick, not quite well.'},
  {e:[T('PROM',96,132,54,{r:-7}),T('ISE',210,172,54,{r:9}),P('M156 44 L144 100 L164 136 L146 190 L160 256')],a:['broken promise','broken promises'],h:'Something you should never do to a friend.'},
  {e:[T('TRAVEL',150,108,54),T('C C C C',150,200,50)],a:['travel overseas','overseas travel'],h:'Say the letters below as one word. Going abroad.'},
  {e:[T('MILL1ON',150,150,54)],a:['one in a million'],h:'Find the odd character.'},
  {e:[T('STA4NCE',150,150,52)],a:['for instance'],h:'Find the number.'},
  {e:[T('DEATH',90,150,42),T('LIFE',218,150,42)],a:['life after death'],h:'Which word comes after which?'},
  {e:[T("HE'S",66,150,38),T('HIMSELF',196,150,38)],a:["he's beside himself",'beside himself','hes beside himself'],h:'Look where he is standing. Very upset.'},
  {e:[T('TIIIIIIME',150,112,48),T('C',150,200,70,{deco:'strike'})],a:['long time no see'],h:'Stretched out, and a letter is missing.'},
  {e:[T('OHOLENE',150,150,52)],a:['hole in one','a hole in one'],h:'A golfer’s dream. Look inside the word.'},
  {e:[T('i i i i',150,150,72)],a:['four eyes','4 eyes'],h:'Count them, and say the letter as a body part.'},
  {e:[T('ARSHOTM',150,150,50)],a:['shot in the arm','a shot in the arm'],h:'A boost. Look inside the word.'},
  {e:[T('EGGS',150,112,58),T('EASY',150,200,58)],a:['eggs over easy','eggs over-easy'],h:'A way to order breakfast.'},
];

const EXPERT=[
  {e:[T('MIND',150,112,60),T('MATTER',150,200,56)],a:['mind over matter'],h:'Willpower wins.'},
  {e:[T('SITTING',150,100,44),T('WORLD',150,190,64)],a:['sitting on top of the world','on top of the world'],h:'Feeling fantastic. Where is SITTING?'},
  {e:[T('WORLD',150,150,18)],a:['small world',"it's a small world",'its a small world'],h:'Look at the size. Said when you meet someone you know far from home.'},
  {e:[T('GET IT',150,72,40),T('GET IT',150,126,40),T('GET IT',150,180,40),T('GET IT',150,234,40)],a:['forget it','forget about it'],h:'Count them, then say the number.'},
  {e:[T('BAN',82,135,50,{r:-7}),T('ANA',222,170,50,{r:9}),P('M156 44 L144 100 L164 136 L146 190 L160 256')],a:['banana split'],h:'A dessert with ice cream.'},
  {e:[T('R',75,150,52),T('O',125,150,52),T('A',175,150,52),T('D',225,150,52),T('R',125,95,52),T('A',125,205,52),T('D',125,260,52)],a:['crossroads','crossroad','cross roads'],h:'Two of them meet. A big decision point.'},
  {e:[T('AGE',60,150,40),T('BEAUTY',198,150,38)],a:['age before beauty'],h:'A cheeky way to let someone go first.'},
  {e:[T('YOU',55,150,36),T('JUST',156,150,30),T('ME',246,150,36)],a:['just between you and me','between you and me'],h:'Said before sharing a secret.'},
  {e:[T('P',42,165,26),T('A',80,162,38),T('I',122,158,50),T('N',175,154,62),T('S',240,150,78)],a:['growing pains','growing pain'],h:'Watch the letters change. Teenagers have them.'},
  {e:[T('ARREST',150,112,54),T("YOU'RE",150,200,54)],a:["you're under arrest",'youre under arrest','under arrest'],h:'What the police say.'},
  {e:[T('DEAL',150,155,92)],a:['big deal'],h:'Not impressed? Say this.'},
  {e:[T('10SE',150,150,70)],a:['tense'],h:'Say the number out loud.'},
  {e:[T('STOOD',150,112,58),T('MISS',150,200,58)],a:['misunderstood','miss understood'],h:'Read what is under what.'},
  {e:[T('ALL 4 1',150,112,50),T('1 4 ALL',150,200,50)],a:['all for one and one for all','all for one one for all'],h:'The Three Musketeers. Say the numbers as words.'},
  {e:[T('CHECK',150,112,56),T('CHECK',150,200,56)],a:['double check','double-check','check twice'],h:'Make sure. Twice.'},
  {e:[T('MOTLAWHER',150,150,40)],a:['mother in law','mother-in-law'],h:'A relative by marriage. Look inside.'},
  {e:[T('HISTORY',150,90,44),T('HISTORY',150,150,44),T('HISTORY',150,210,44)],a:['history repeats itself','history repeats'],h:'What the past keeps doing.'},
];

const LEGEND=[
  {e:[T('HAHANDND',150,150,42)],a:['hand in hand'],h:'Look inside the word.'},
  {e:[T('C C C C C C C',150,150,36)],a:['seven seas','the seven seas','7 seas'],h:'Count the letters. Sailors cross them all.'},
  {e:[T('EZ',150,100,70),T('i i i',150,200,56)],a:['easy on the eyes','easy on the eye'],h:'Say the top letters, then what they sit on.'},
  {e:[T('GIVE',95,72,40),T('GET',210,72,40),T('GIVE',95,126,40),T('GET',210,126,40),T('GIVE',95,180,40),T('GET',210,180,40),T('GIVE',95,234,40),T('GET',210,234,40)],a:['forgive and forget'],h:'Count each word. Advice after an argument.'},
  {e:[T('BJAOCXK',150,150,50)],a:['jack in the box','jack-in-the-box'],h:'Two words are woven together.'},
  {e:[T('0',150,80,64),L(60,125,240,125),T('M.D.',62,180,30),T('Ph.D.',150,180,30),T('B.S.',238,180,30)],a:['three degrees below zero','3 degrees below zero','degrees below zero'],h:'What are M.D., Ph.D. and B.S.? Where are they?'},
  {e:[T('GO',150,70,56),T('IT IT IT IT',150,170,40)],a:['go for it','go 4 it'],h:'Count the ITs.'},
  {e:[T('YY U R',150,66,36),T('YY U B',150,122,36),T('I C U R',150,178,36),T('YY 4 ME',150,234,36)],a:['too wise you are too wise you be i see you are too wise for me','too wise you are too wise you be'],h:'Say every letter and number as a word. What are two Ys?'},
  {e:[T('FA',62,150,56),T('RED',150,150,34),T('CE',238,150,56)],a:['red in the face','red faced'],h:'Embarrassed. Where is RED?'},
  {e:[T('MCE',150,80,56),T('MCE',150,150,56),T('MCE',150,220,56)],a:['three blind mice','3 blind mice'],h:'Each word is missing its "eye". A nursery rhyme.'},
  {e:[T('JOB',62,150,46),T('IN',150,150,40),T('JOB',238,150,46)],a:['in between jobs','between jobs'],h:'Out of work, for now. Where is IN?'},
  {e:[T('LITTLE',150,72,36),T('LITTLE',150,126,36),T('LATE',150,186,40),T('LATE',150,240,40)],a:['too little too late','too little, too late'],h:'Two of each. Say “two” another way.'},
  {e:[P('M150 46 L262 244 L38 244 Z'),T('LOVE',150,182,40)],a:['love triangle'],h:'A tricky romance. Look at the shape.'},
];

// mult scales points for each solve; maxHints is how many hints a note allows.
const LEVELS=[
  {name:'Beginner',blurb:'Emoji sound-alikes',pool:EASY,mult:1,maxHints:2},
  {name:'Intermediate',blurb:'Where the words sit',pool:MEDIUM,mult:1.5,maxHints:2},
  {name:'Advanced',blurb:'Letters and numbers',pool:HARD,mult:2,maxHints:2},
  {name:'Expert',blurb:'Size, sound and spacing',pool:EXPERT,mult:2.5,maxHints:2},
  {name:'Legend',blurb:'One hint only',pool:LEGEND,mult:3,maxHints:1},
];

const ROUND=10;
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'');
function lev(a,b){const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
function matches(guess,answers){const g=norm(guess);if(!g)return false;return answers.some(a=>{const n=norm(a);const tol=n.length>=12?2:n.length>=6?1:0;return g===n||lev(g,n)<=tol})}
module.exports={LEVELS,ROUND,matches};
