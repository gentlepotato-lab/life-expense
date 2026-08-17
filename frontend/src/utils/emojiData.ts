/**
 * 이모지 목록.
 *
 * 새 패키지를 들이지 않으려고 표를 직접 들고 있다.
 * 한 줄은 "이모지 검색어1 검색어2 ..." 형태이고, 검색어는 한글·영문을
 * 섞어 둔다. 이름을 모를 때도 "밥", "food" 어느 쪽으로든 찾히게 하려는 것이다.
 */

export type EmojiGroup = { key: string; label: string; items: string[] };

const RAW: EmojiGroup[] = [
  {
    key: "food",
    label: "음식",
    items: [
      "🍚 밥 쌀 rice", "🍙 주먹밥 onigiri", "🍘 과자 senbei", "🍜 라면 국수 noodle ramen",
      "🍲 찌개 전골 stew", "🥘 볶음 paella", "🍛 카레 curry", "🍝 파스타 스파게티 pasta",
      "🍕 피자 pizza", "🍔 햄버거 burger", "🌭 핫도그 hotdog", "🥪 샌드위치 sandwich",
      "🌮 타코 taco", "🌯 부리토 burrito", "🥙 케밥 kebab", "🥗 샐러드 salad",
      "🍗 치킨 닭 chicken", "🍖 고기 meat", "🥩 스테이크 소고기 steak", "🥓 베이컨 bacon",
      "🍳 계란 달걀 egg", "🥚 알 egg", "🧀 치즈 cheese", "🥐 크루아상 croissant",
      "🍞 빵 bread", "🥖 바게트 baguette", "🥯 베이글 bagel", "🥞 팬케이크 pancake",
      "🧇 와플 waffle", "🍟 감자튀김 fries", "🥟 만두 dumpling", "🍣 초밥 스시 sushi",
      "🍤 새우 shrimp", "🦀 게 crab", "🦞 랍스터 lobster", "🐟 생선 fish",
      "🍱 도시락 bento", "🍢 어묵 oden", "🍡 경단 dango", "🥠 포춘쿠키 fortune",
      "🍪 쿠키 cookie", "🍰 케이크 cake", "🎂 생일케이크 birthday cake", "🧁 컵케이크 cupcake",
      "🥧 파이 pie", "🍫 초콜릿 chocolate", "🍬 사탕 candy", "🍭 막대사탕 lollipop",
      "🍮 푸딩 pudding", "🍯 꿀 honey", "🍦 아이스크림 icecream", "🍨 아이스크림 icecream",
      "🍧 빙수 shavedice", "🥛 우유 milk", "☕ 커피 카페 coffee", "🍵 차 녹차 tea",
      "🧋 버블티 밀크티 bubbletea", "🥤 음료 소다 drink soda", "🧃 주스 juice", "🍺 맥주 beer",
      "🍻 맥주 건배 beer cheers", "🍷 와인 wine", "🍸 칵테일 cocktail", "🍹 칵테일 tropical",
      "🥃 위스키 whisky", "🍶 사케 소주 sake", "🍾 샴페인 champagne", "🧊 얼음 ice",
      "🥢 젓가락 chopsticks", "🍴 포크 나이프 fork", "🥄 숟가락 spoon", "🍽️ 식기 dining",
      "🥦 브로콜리 broccoli", "🥬 채소 배추 vegetable", "🥕 당근 carrot", "🌽 옥수수 corn",
      "🥔 감자 potato", "🍠 고구마 sweetpotato", "🍅 토마토 tomato", "🍆 가지 eggplant",
      "🥒 오이 cucumber", "🌶️ 고추 pepper", "🧄 마늘 garlic", "🧅 양파 onion",
      "🍄 버섯 mushroom", "🥜 땅콩 peanut", "🌰 밤 chestnut", "🍎 사과 apple",
      "🍐 배 pear", "🍊 귤 오렌지 orange", "🍋 레몬 lemon", "🍌 바나나 banana",
      "🍉 수박 watermelon", "🍇 포도 grape", "🍓 딸기 strawberry", "🫐 블루베리 blueberry",
      "🍈 멜론 melon", "🍒 체리 cherry", "🍑 복숭아 peach", "🥭 망고 mango",
      "🍍 파인애플 pineapple", "🥥 코코넛 coconut", "🥑 아보카도 avocado", "🧂 소금 salt",
    ],
  },
  {
    key: "travel",
    label: "이동·장소",
    items: [
      "🚌 버스 bus", "🚏 정류장 busstop", "🚇 지하철 subway metro", "🚆 기차 train",
      "🚄 고속열차 ktx train", "🚈 전철 train", "🚕 택시 taxi", "🚗 자동차 차 car",
      "🚙 SUV car", "🏎️ 경주차 racing", "🚚 트럭 truck", "🚛 트럭 truck",
      "🛻 픽업 truck", "🏍️ 오토바이 motorcycle", "🛵 스쿠터 scooter", "🚲 자전거 bike",
      "🛴 킥보드 kickboard", "🛹 스케이트보드 skateboard", "✈️ 비행기 항공 airplane",
      "🛫 출발 departure", "🛬 도착 arrival", "🚀 로켓 rocket", "🚁 헬기 helicopter",
      "🚢 배 ship", "⛴️ 페리 ferry", "⛵ 요트 sailboat", "🚤 보트 boat",
      "⛽ 주유 기름 gas fuel", "🅿️ 주차 parking", "🚦 신호등 traffic", "🛣️ 도로 road",
      "🗺️ 지도 map", "🧭 나침반 compass", "🧳 여행가방 luggage", "🎒 배낭 backpack",
      "🏠 집 home house", "🏡 집 마당 house", "🏢 회사 빌딩 office building", "🏬 백화점 department",
      "🏪 편의점 convenience", "🏫 학교 school", "🏥 병원 hospital", "🏦 은행 bank",
      "🏨 호텔 hotel", "🏝️ 섬 island", "🏖️ 해변 beach", "⛰️ 산 mountain",
      "🏕️ 캠핑 camping", "🎡 놀이공원 amusement", "🎢 롤러코스터 rollercoaster", "⛲ 분수 fountain",
      "🗼 타워 tower", "🏛️ 관공서 classical", "⛪ 교회 church", "🛕 사원 temple",
      "🌉 다리 bridge", "🌃 야경 night city", "🏙️ 도시 city", "🌆 도시 노을 city",
    ],
  },
  {
    key: "life",
    label: "생활·쇼핑",
    items: [
      "🛒 장보기 마트 cart shopping", "🛍️ 쇼핑 shopping bag", "🎁 선물 gift", "💐 꽃다발 flower",
      "🌷 꽃 tulip", "🌹 장미 rose", "🌻 해바라기 sunflower", "🌱 새싹 seedling",
      "🪴 화분 plant", "🌳 나무 tree", "👕 옷 티셔츠 clothes shirt", "👔 셔츠 정장 shirt",
      "👗 원피스 dress", "👖 바지 청바지 jeans", "🧥 코트 coat", "🧦 양말 socks",
      "👟 운동화 신발 shoes", "👞 구두 shoes", "👠 하이힐 heels", "🥾 부츠 boots",
      "👜 가방 bag", "🎒 책가방 backpack", "👛 지갑 purse", "👓 안경 glasses",
      "🕶️ 선글라스 sunglasses", "⌚ 시계 watch", "💍 반지 ring", "💄 화장품 립스틱 cosmetics",
      "🧴 로션 lotion", "🧼 비누 soap", "🪥 칫솔 toothbrush", "🧻 휴지 tissue",
      "🧺 빨래 laundry", "🧹 청소 cleaning", "🧽 수세미 sponge", "🛁 욕조 bath",
      "🚿 샤워 shower", "🚽 화장실 toilet", "🛏️ 침대 bed", "🛋️ 소파 sofa",
      "🪑 의자 chair", "🚪 문 door", "🔑 열쇠 key", "🔒 자물쇠 lock",
      "💡 전기 조명 light electricity", "🔌 플러그 전기 plug", "🔋 배터리 battery", "🚰 수도 물 water",
      "🔥 가스 불 gas fire", "❄️ 냉방 에어컨 cold ac", "🌡️ 온도 temperature", "🧯 소화기 extinguisher",
      "🧰 공구 toolbox", "🔧 수리 wrench repair", "🔨 망치 hammer", "🪚 톱 saw",
      "✂️ 미용 가위 scissors haircut", "🪞 거울 mirror", "🕯️ 초 candle", "🪟 창문 window",
    ],
  },
  {
    key: "health",
    label: "건강·운동",
    items: [
      "🏥 병원 hospital", "💊 약 약국 medicine pharmacy", "💉 주사 injection", "🩺 진료 검진 checkup",
      "🩹 반창고 bandage", "🦷 치과 dental", "👁️ 안과 eye", "🧠 정신 brain",
      "🫀 심장 heart", "🩸 헌혈 blood", "🏋️ 헬스 운동 gym workout", "🤸 체조 gymnastics",
      "🧘 요가 명상 yoga", "🏃 달리기 running", "🚶 걷기 walking", "🥊 복싱 boxing",
      "🏊 수영 swimming", "🚴 사이클 cycling", "⚽ 축구 soccer", "⚾ 야구 baseball",
      "🏀 농구 basketball", "🏐 배구 volleyball", "🎾 테니스 tennis", "🏸 배드민턴 badminton",
      "🏓 탁구 pingpong", "⛳ 골프 golf", "🎳 볼링 bowling", "🎿 스키 ski",
      "⛸️ 스케이트 skating", "🧗 클라이밍 climbing", "🏄 서핑 surfing", "🎣 낚시 fishing",
      "🥋 무술 태권도 martial", "🏅 메달 medal", "🏆 트로피 trophy", "🎯 다트 목표 target",
    ],
  },
  {
    key: "fun",
    label: "문화·취미",
    items: [
      "🎬 영화 movie", "🍿 팝콘 popcorn", "🎭 공연 연극 theater", "🎤 노래방 karaoke",
      "🎵 음악 music", "🎧 이어폰 headphone", "🎸 기타 guitar", "🎹 피아노 piano",
      "🥁 드럼 drum", "🎺 트럼펫 trumpet", "🎻 바이올린 violin", "📻 라디오 radio",
      "🎮 게임 game", "🕹️ 오락 arcade", "🎲 보드게임 board", "🃏 카드 card",
      "♟️ 체스 chess", "🧩 퍼즐 puzzle", "📚 책 도서 book", "📖 독서 reading",
      "📰 신문 news", "✏️ 연필 pencil", "🖊️ 펜 pen", "🖌️ 붓 brush",
      "🎨 미술 art", "📷 사진 camera", "📸 촬영 photo", "🎥 영상 video",
      "📺 티비 tv", "🎞️ 필름 film", "🎪 서커스 circus", "🎠 회전목마 carousel",
      "🎉 파티 party", "🎊 축하 celebrate", "🎈 풍선 balloon", "🎇 불꽃 fireworks",
      "🪅 파티 pinata", "🧸 인형 toy", "🪁 연 kite", "🎽 마라톤 running",
    ],
  },
  {
    key: "money",
    label: "금융·업무",
    items: [
      "💰 돈 money", "💵 현금 지폐 cash", "💴 엔 yen", "💶 유로 euro",
      "💷 파운드 pound", "🪙 동전 coin", "💳 카드 신용카드 card", "🧾 영수증 receipt",
      "🏦 은행 bank", "🏧 ATM 현금인출 atm", "💹 환율 exchange", "📈 상승 수익 profit up",
      "📉 하락 손실 loss down", "📊 통계 차트 chart", "💸 지출 소비 spend", "🤑 부자 rich",
      "🪝 갈고리 hook", "📅 달력 일정 calendar", "🗓️ 일정 schedule", "⏰ 알람 alarm",
      "⌛ 시간 time", "📌 고정 pin", "📎 클립 clip", "📁 폴더 folder",
      "📂 자료 file", "🗂️ 분류 index", "📋 목록 clipboard", "📝 메모 note",
      "✉️ 편지 mail", "📧 이메일 email", "📮 우편 post", "📦 택배 배송 package delivery",
      "🖨️ 인쇄 print", "💻 노트북 laptop", "🖥️ 컴퓨터 desktop", "⌨️ 키보드 keyboard",
      "🖱️ 마우스 mouse", "📱 휴대폰 phone", "☎️ 전화 telephone", "📞 통화 call",
      "🌐 인터넷 internet", "📡 통신 signal", "🔍 검색 search", "🔔 알림 bell",
      "🏢 회사 office", "💼 업무 가방 briefcase work", "🧑‍💻 개발 developer", "📶 데이터 통신 data",
    ],
  },
  {
    key: "people",
    label: "사람·동물",
    items: [
      "🧑 사람 person", "👤 익명 anonymous", "👥 사람들 people", "👨 남자 man",
      "👩 여자 woman", "🧒 아이 child", "👶 아기 baby", "🧓 노인 elder",
      "👨‍👩‍👧 가족 family", "👨‍👩‍👧‍👦 가족 family", "🧑‍🤝‍🧑 친구 friend", "💑 커플 couple",
      "💏 연인 kiss", "👰 결혼 wedding", "🤝 협력 악수 handshake", "🙏 감사 부탁 thanks",
      "👋 인사 hello", "💪 힘 strong", "🧑‍🍳 요리사 chef", "🧑‍🏫 선생님 teacher",
      "🧑‍⚕️ 의사 doctor", "🧑‍🔧 정비 mechanic", "🧑‍🌾 농부 farmer", "🧑‍🎓 학생 졸업 student",
      "🐶 강아지 개 dog", "🐱 고양이 cat", "🐰 토끼 rabbit", "🐹 햄스터 hamster",
      "🐦 새 bird", "🦜 앵무새 parrot", "🐟 물고기 fish", "🐢 거북 turtle",
      "🐾 반려동물 pet paw", "🦴 뼈 bone", "🐴 말 horse", "🐮 소 cow",
      "🐷 돼지 pig", "🐔 닭 chicken", "🦋 나비 butterfly", "🐝 벌 bee",
    ],
  },
  {
    key: "symbol",
    label: "기호·기타",
    items: [
      "⭐ 별 즐겨찾기 star", "🌟 반짝 sparkle", "✨ 반짝임 sparkles", "❤️ 하트 heart",
      "🧡 주황하트 heart", "💛 노랑하트 heart", "💚 초록하트 heart", "💙 파랑하트 heart",
      "💜 보라하트 heart", "🖤 검정하트 heart", "🤍 흰하트 heart", "💯 백점 100",
      "✅ 완료 check done", "☑️ 체크 check", "❌ 취소 cancel", "⛔ 금지 stop",
      "⚠️ 주의 warning", "❗ 중요 important", "❓ 질문 question", "💡 아이디어 idea",
      "🔥 인기 hot fire", "💧 물 water drop", "🌊 파도 wave", "🌈 무지개 rainbow",
      "☀️ 맑음 sun", "🌤️ 구름 cloud", "🌧️ 비 rain", "⛈️ 폭우 storm",
      "❄️ 눈 snow", "☃️ 눈사람 snowman", "🌙 달 밤 moon night", "🌏 지구 earth",
      "🔴 빨강 red", "🟠 주황 orange", "🟡 노랑 yellow", "🟢 초록 green",
      "🔵 파랑 blue", "🟣 보라 purple", "⚫ 검정 black", "⚪ 하양 white",
      "🔶 마름모 diamond", "🔷 마름모 diamond", "🔺 세모 triangle", "⬛ 네모 square",
      "♻️ 재활용 recycle", "🔄 반복 repeat", "🔝 위 top", "🆕 신규 new",
      "🆓 무료 free", "🈹 할인 discount", "🎫 티켓 ticket", "🎟️ 입장권 ticket",
      "🏷️ 태그 라벨 tag", "🔖 북마크 bookmark", "📍 위치 location", "🗑️ 삭제 trash",
    ],
  },
];

export type EmojiEntry = { char: string; keywords: string };

/** "이모지 검색어..." 한 줄을 쪼갠다 */
const parse = (line: string): EmojiEntry => {
  const i = line.indexOf(" ");
  return i < 0
    ? { char: line, keywords: "" }
    : { char: line.slice(0, i), keywords: line.slice(i + 1).toLowerCase() };
};

/**
 * 같은 이모지가 여러 분류에 걸치는 경우가 있다(병원은 장소이면서 건강).
 * 그대로 두면 목록에 같은 키가 두 번 나와 화면이 뒤엉키므로,
 * 문자 하나당 하나로 합치고 검색어만 이어 붙인다.
 */
const merged = new Map<string, string>();
for (const g of RAW) {
  for (const line of g.items) {
    const e = parse(line);
    const prev = merged.get(e.char);
    merged.set(e.char, prev ? `${prev} ${e.keywords}` : e.keywords);
  }
}

const entryOf = (char: string): EmojiEntry => ({
  char,
  keywords: merged.get(char) ?? "",
});

export const EMOJI_GROUPS: { key: string; label: string; items: EmojiEntry[] }[] =
  RAW.map((g) => {
    const seen = new Set<string>();
    const items: EmojiEntry[] = [];
    for (const line of g.items) {
      const char = parse(line).char;
      if (seen.has(char)) continue;
      seen.add(char);
      items.push(entryOf(char));
    }
    return { key: g.key, label: g.label, items };
  });

/** 분류를 가로질러 중복 없이 모은 전체 목록 */
export const EMOJI_ALL: EmojiEntry[] = [...merged.keys()].map(entryOf);

/** 검색어로 거른다. 비어 있으면 전체를 그대로 돌려준다 */
export function searchEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return EMOJI_ALL;
  return EMOJI_ALL.filter((e) => e.keywords.includes(q) || e.char === q);
}
