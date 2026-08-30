/**
 * 이모지 목록.
 *
 * 새 패키지를 들이지 않으려고 표를 직접 들고 있다.
 * 한 줄은 "이모지 검색어1 검색어2 ..." 형태이고, 검색어는 한글·영문을
 * 섞어 둔다. 이름을 모를 때도 "밥", "food" 어느 쪽으로든 찾히게 하려는 것이다.
 *
 * 표정을 맨 앞에 둔다. 돈쓴이의 얼굴을 고르는 자리에서 가장 먼저 찾는 것이고,
 * 뒤에 두면 아홉 묶음을 지나서야 나온다.
 */

export type EmojiGroup = { key: string; label: string; items: string[] };

const RAW: EmojiGroup[] = [
  {
    key: "face",
    label: "표정·감정",
    items: [
      "🙂 미소 웃음 smile", "😀 웃음 grin", "😃 활짝 웃음 smile", "😄 즐거움 happy",
      "😁 이 활짝 beam", "😆 폭소 laugh", "😅 식은땀 sweat", "🤣 뒤집어짐 rofl",
      "😂 눈물나게 웃음 joy", "🙃 뒤집힌 얼굴 upside", "🫠 녹음 melting", "😉 윙크 wink",
      "😊 흐뭇 blush", "😇 천사 angel", "🥰 사랑스러움 love", "😍 하트눈 heart eyes",
      "🤩 반짝눈 star struck", "😘 뽀뽀 kiss", "😗 입맞춤 kiss", "😚 뽀뽀 kiss",
      "😙 미소 뽀뽀 kiss", "🥲 눈물 웃음 tear", "😋 맛있다 yum", "😛 메롱 tongue",
      "😜 장난 wink tongue", "🤪 익살 zany", "😝 약올림 tongue", "🤑 돈밝힘 money",
      "🤗 안아줌 hug", "🤭 입가림 giggle", "🫢 놀라 입가림 shock", "🫣 훔쳐봄 peek",
      "🤫 쉿 quiet", "🤔 고민 생각 think", "🫡 경례 salute", "🤐 입다뭄 zipper",
      "🤨 의심 눈썹 raised", "😐 무표정 neutral", "😑 시큰둥 expressionless", "😶 말없음 silent",
      "🫥 흐릿함 dotted", "😏 씨익 smirk", "😒 떨떠름 unamused", "🙄 눈굴림 eyeroll",
      "😬 어색 grimace", "🫨 흔들림 shaking", "🤥 거짓말 lying", "😌 후련 relieved",
      "😔 시무룩 pensive", "😪 졸림 sleepy", "🤤 침 drool", "😴 잠 sleep",
      "😷 마스크 mask", "🤒 열 fever", "🤕 다침 hurt", "🤢 메스꺼움 nausea",
      "🤮 토함 vomit", "🤧 재채기 sneeze", "🥵 더움 hot", "🥶 추움 cold",
      "🥴 어질 woozy", "😵 어지러움 dizzy", "🤯 머리터짐 exploding", "🤠 카우보이 cowboy",
      "🥳 축하 party", "🥸 변장 disguise", "😎 선글라스 cool", "🤓 공부 nerd",
      "🧐 관찰 monocle", "😕 갸웃 confused", "🫤 떨떠름 diagonal", "😟 걱정 worried",
      "🙁 시무룩 frown", "😮 놀람 open mouth", "😯 헉 hushed", "😲 깜짝 astonished",
      "😳 당황 flushed", "🥺 애원 pleading", "🥹 참는 눈물 holding tears", "😦 걱정 frown",
      "😧 괴로움 anguished", "😨 무서움 fearful", "😰 식은땀 anxious", "😥 안도 눈물 sad",
      "😢 눈물 cry", "😭 펑펑 sob", "😱 비명 scream", "😖 괴로움 confounded",
      "😣 애씀 persevere", "😞 실망 disappoint", "😓 낙담 downcast", "😩 지침 weary",
      "😫 힘듦 tired", "🥱 하품 yawn", "😤 씩씩 triumph", "😡 화남 rage",
      "😠 성남 angry", "🤬 욕 cursing", "😈 장난 악마 devil", "👿 악마 imp",
      "💀 해골 skull", "💩 응가 poop", "🤡 광대 clown", "👻 유령 ghost",
      "👽 외계인 alien", "🤖 로봇 robot", "🎃 호박 pumpkin", "😺 고양이 웃음 cat",
      "😸 고양이 기쁨 cat", "😹 고양이 눈물 cat", "😻 고양이 사랑 cat", "😼 고양이 씨익 cat",
      "😽 고양이 뽀뽀 cat", "🙀 고양이 놀람 cat", "😿 고양이 울음 cat", "😾 고양이 삐짐 cat",
      "🙈 안 볼래 see no", "🙉 안 들을래 hear no", "🙊 말 안 할래 speak no",
      "💖 반짝하트 sparkle heart", "💗 두근 heart", "💓 심장 heart", "💞 하트 둘 heart",
      "💕 하트 둘 heart", "💘 화살 하트 cupid", "💝 선물 하트 heart", "💔 이별 broken",
      "❣️ 느낌표 하트 heart", "💤 쿨쿨 zzz", "💢 화 anger", "💥 충격 boom",
      "💫 어지 dizzy", "💦 땀 sweat", "🗯️ 버럭 anger bubble", "💬 말풍선 speech",
      "💭 생각 풍선 thought", "👍 좋아요 good thumbs", "👎 싫어요 bad thumbs",
      "👌 오케이 ok", "🤌 손가락 pinch", "🤏 조금 little", "✌️ 브이 peace",
      "🤞 행운 fingers crossed", "🫰 손하트 finger heart", "🤟 사랑해 love you",
      "🤘 락 rock", "🤙 전화해 call me", "👈 왼쪽 left", "👉 오른쪽 right",
      "👆 위 up", "👇 아래 down", "☝️ 하나 one", "✋ 손 hand",
      "🤚 손등 back hand", "🖐️ 손바닥 hand", "🖖 벌칸 vulcan", "🫱 오른손 hand",
      "🫲 왼손 hand", "🫳 아래로 손 palm down", "🫴 위로 손 palm up", "👏 박수 clap",
      "🙌 만세 raise", "🫶 하트 손 heart hands", "👐 두 손 open hands", "🤲 두 손 모음 palms",
      "✍️ 쓰기 writing", "💅 네일 nail", "🤳 셀카 selfie", "🦾 기계팔 mechanical",
      "🫵 너 point you", "👋 인사 hello", "💪 힘 strong",
      "🤝 악수 handshake", "🙏 감사 부탁 thanks pray",
    ],
  },
  {
    key: "food",
    label: "음식",
    items: [
      "🍚 밥 쌀 rice", "🍙 주먹밥 onigiri", "🍘 과자 senbei", "🍜 라면 국수 noodle ramen",
      "🍲 찌개 전골 stew", "🥘 볶음 paella", "🍛 카레 curry", "🍝 파스타 스파게티 pasta",
      "🍕 피자 pizza", "🍔 햄버거 burger", "🌭 핫도그 hotdog", "🥪 샌드위치 sandwich",
      "🌮 타코 taco", "🌯 부리토 burrito", "🫔 타말레 tamale", "🥙 케밥 kebab",
      "🧆 팔라펠 falafel", "🥗 샐러드 salad", "🥣 시리얼 cereal", "🫕 퐁뒤 fondue",
      "🍗 치킨 닭 chicken", "🍖 고기 meat", "🥩 스테이크 소고기 steak", "🥓 베이컨 bacon",
      "🍳 계란 달걀 egg", "🥚 알 egg", "🧀 치즈 cheese", "🥐 크루아상 croissant",
      "🍞 빵 bread", "🥖 바게트 baguette", "🥯 베이글 bagel", "🫓 납작빵 flatbread",
      "🥞 팬케이크 pancake", "🧇 와플 waffle", "🍟 감자튀김 fries", "🥟 만두 dumpling",
      "🍣 초밥 스시 sushi", "🍤 새우 shrimp", "🦀 게 crab", "🦞 랍스터 lobster",
      "🦐 새우 shrimp", "🦑 오징어 squid", "🦪 굴 oyster", "🐟 생선 fish",
      "🍱 도시락 bento", "🍢 어묵 oden", "🍡 경단 dango", "🥠 포춘쿠키 fortune",
      "🥡 포장 takeout", "🍪 쿠키 cookie", "🍰 케이크 cake", "🎂 생일케이크 birthday cake",
      "🧁 컵케이크 cupcake", "🥧 파이 pie", "🍫 초콜릿 chocolate", "🍬 사탕 candy",
      "🍭 막대사탕 lollipop", "🍮 푸딩 pudding", "🍯 꿀 honey", "🍦 아이스크림 icecream",
      "🍨 아이스크림 icecream", "🍧 빙수 shavedice", "🥛 우유 milk", "🍼 분유 baby bottle",
      "☕ 커피 카페 coffee", "🫖 찻주전자 teapot", "🍵 차 녹차 tea", "🧋 버블티 밀크티 bubbletea",
      "🥤 음료 소다 drink soda", "🧃 주스 juice", "🧉 마테 mate", "🍺 맥주 beer",
      "🍻 맥주 건배 beer cheers", "🍷 와인 wine", "🥂 건배 샴페인 cheers", "🍸 칵테일 cocktail",
      "🍹 칵테일 tropical", "🥃 위스키 whisky", "🍶 사케 소주 sake", "🍾 샴페인 champagne",
      "🧊 얼음 ice", "🥢 젓가락 chopsticks", "🍴 포크 나이프 fork", "🥄 숟가락 spoon",
      "🍽️ 식기 dining", "🧂 소금 salt", "🧈 버터 butter", "🥫 통조림 canned",
      "🥦 브로콜리 broccoli", "🥬 채소 배추 vegetable", "🥕 당근 carrot", "🌽 옥수수 corn",
      "🥔 감자 potato", "🍠 고구마 sweetpotato", "🍅 토마토 tomato", "🍆 가지 eggplant",
      "🥒 오이 cucumber", "🌶️ 고추 pepper", "🫑 파프리카 bellpepper", "🧄 마늘 garlic",
      "🧅 양파 onion", "🍄 버섯 mushroom", "🥜 땅콩 peanut", "🫘 콩 beans",
      "🌰 밤 chestnut", "🍎 사과 apple", "🍏 풋사과 green apple", "🍐 배 pear",
      "🍊 귤 오렌지 orange", "🍋 레몬 lemon", "🍌 바나나 banana", "🍉 수박 watermelon",
      "🍇 포도 grape", "🍓 딸기 strawberry", "🫐 블루베리 blueberry", "🍈 멜론 melon",
      "🍒 체리 cherry", "🍑 복숭아 peach", "🥭 망고 mango", "🍍 파인애플 pineapple",
      "🥥 코코넛 coconut", "🥑 아보카도 avocado", "🫒 올리브 olive", "🥝 키위 kiwi",
    ],
  },
  {
    key: "travel",
    label: "이동·장소",
    items: [
      "🚌 버스 bus", "🚍 버스 bus", "🚏 정류장 busstop", "🚇 지하철 subway metro",
      "🚆 기차 train", "🚄 고속열차 ktx train", "🚅 고속철 train", "🚈 전철 train",
      "🚂 증기기관차 locomotive", "🚝 모노레일 monorail", "🚊 트램 tram", "🚋 전차 tram",
      "🚕 택시 taxi", "🚖 택시 taxi", "🚗 자동차 차 car", "🚘 차 car",
      "🚙 SUV car", "🛺 릭샤 auto", "🏎️ 경주차 racing", "🚚 트럭 truck",
      "🚛 트럭 truck", "🛻 픽업 truck", "🚐 승합차 van", "🚑 구급차 ambulance",
      "🚒 소방차 firetruck", "🚓 경찰차 police", "🏍️ 오토바이 motorcycle", "🛵 스쿠터 scooter",
      "🚲 자전거 bike", "🛴 킥보드 kickboard", "🛹 스케이트보드 skateboard", "🛼 롤러스케이트 roller",
      "🦽 휠체어 wheelchair", "✈️ 비행기 항공 airplane", "🛩️ 경비행기 plane", "🛫 출발 departure",
      "🛬 도착 arrival", "🪂 낙하산 parachute", "🚀 로켓 rocket", "🛸 UFO ufo",
      "🚁 헬기 helicopter", "🚢 배 ship", "⛴️ 페리 ferry", "🛳️ 여객선 cruise",
      "⛵ 요트 sailboat", "🚤 보트 boat", "🛶 카누 canoe", "⚓ 닻 anchor",
      "⛽ 주유 기름 gas fuel", "🔌 충전 charge", "🅿️ 주차 parking", "🚧 공사 construction",
      "🚦 신호등 traffic", "🚥 신호 signal", "🛣️ 도로 road", "🛤️ 철길 railway",
      "🗺️ 지도 map", "🧭 나침반 compass", "🧳 여행가방 luggage", "🎒 배낭 backpack",
      "🛂 출입국 passport", "🛃 세관 customs", "🛄 수하물 baggage", "🎫 탑승권 ticket",
      "🏠 집 home house", "🏡 집 마당 house", "🏘️ 주택가 houses", "🏚️ 폐가 house",
      "🏢 회사 빌딩 office building", "🏣 우체국 postoffice", "🏤 우체국 post", "🏬 백화점 department",
      "🏪 편의점 convenience", "🏫 학교 school", "🏥 병원 hospital", "🏦 은행 bank",
      "🏨 호텔 hotel", "🏩 러브호텔 hotel", "🏛️ 관공서 classical", "🏭 공장 factory",
      "🏗️ 건설 construction", "🏰 성 castle", "🏯 성 castle", "🗿 석상 moai",
      "🗽 자유의 여신 statue", "🗼 타워 tower", "🌇 노을 sunset", "🌅 일출 sunrise",
      "🏝️ 섬 island", "🏖️ 해변 beach", "🏜️ 사막 desert", "⛰️ 산 mountain",
      "🏔️ 설산 mountain", "🌋 화산 volcano", "🏕️ 캠핑 camping", "⛺ 텐트 tent",
      "🎡 놀이공원 amusement", "🎢 롤러코스터 rollercoaster", "⛲ 분수 fountain", "⛪ 교회 church",
      "🕌 이슬람 사원 mosque", "🛕 사원 temple", "⛩️ 신사 shrine", "🕍 회당 synagogue",
      "🌉 다리 bridge", "🌁 안개 도시 foggy", "🌃 야경 night city", "🏙️ 도시 city",
      "🌆 도시 노을 city", "🏞️ 공원 park", "🛖 오두막 hut", "🧱 벽돌 brick",
    ],
  },
  {
    key: "life",
    label: "생활·쇼핑",
    items: [
      "🛒 장보기 마트 cart shopping", "🛍️ 쇼핑 shopping bag", "🎁 선물 gift", "💐 꽃다발 flower",
      "🌷 꽃 tulip", "🌹 장미 rose", "🥀 시든 꽃 wilted", "🌺 히비스커스 hibiscus",
      "🌸 벚꽃 cherry blossom", "🌼 데이지 daisy", "🌻 해바라기 sunflower", "🌱 새싹 seedling",
      "🌿 잎 herb", "🍀 네잎클로버 clover", "🪴 화분 plant", "🌳 나무 tree",
      "🌲 침엽수 tree", "🌴 야자수 palm", "🎋 대나무 bamboo", "🍁 단풍 maple",
      "🍂 낙엽 fallen leaf", "🍃 바람 잎 leaf", "👕 옷 티셔츠 clothes shirt", "👔 셔츠 정장 shirt",
      "👚 블라우스 blouse", "👗 원피스 dress", "🥻 사리 sari", "👘 기모노 kimono",
      "🩱 수영복 swimsuit", "🩳 반바지 shorts", "👖 바지 청바지 jeans", "🧥 코트 coat",
      "🧣 목도리 scarf", "🧤 장갑 gloves", "🧢 모자 cap", "👒 모자 hat",
      "🎩 중절모 tophat", "🧦 양말 socks", "👟 운동화 신발 shoes", "👞 구두 shoes",
      "🥿 플랫 flats", "👠 하이힐 heels", "👡 샌들 sandal", "🥾 부츠 boots",
      "👜 가방 bag", "👝 파우치 pouch", "💼 서류가방 briefcase", "🎒 책가방 backpack",
      "👛 지갑 purse", "👓 안경 glasses", "🕶️ 선글라스 sunglasses", "⌚ 시계 watch",
      "💍 반지 ring", "📿 목걸이 beads", "💄 화장품 립스틱 cosmetics", "🧴 로션 lotion",
      "🧼 비누 soap", "🪥 칫솔 toothbrush", "🪒 면도 razor", "🧻 휴지 tissue",
      "🧺 빨래 laundry", "🧹 청소 cleaning", "🧽 수세미 sponge", "🪣 양동이 bucket",
      "🛁 욕조 bath", "🚿 샤워 shower", "🚽 화장실 toilet", "🪠 뚫어뻥 plunger",
      "🛏️ 침대 bed", "🛋️ 소파 sofa", "🪑 의자 chair", "🚪 문 door",
      "🪟 창문 window", "🖼️ 액자 frame", "🕰️ 벽시계 clock", "🪞 거울 mirror",
      "🕯️ 초 candle", "🔑 열쇠 key", "🗝️ 옛 열쇠 key", "🔒 자물쇠 lock",
      "🔓 열림 unlock", "💡 전기 조명 light electricity", "🔌 플러그 전기 plug", "🔋 배터리 battery",
      "🪫 방전 low battery", "🚰 수도 물 water", "🔥 가스 불 gas fire", "❄️ 냉방 에어컨 cold ac",
      "🌡️ 온도 temperature", "🧯 소화기 extinguisher", "🧰 공구 toolbox", "🔧 수리 wrench repair",
      "🔨 망치 hammer", "🪛 드라이버 screwdriver", "🪚 톱 saw", "🪜 사다리 ladder",
      "🧲 자석 magnet", "🧪 실험 시약 test tube", "✂️ 미용 가위 scissors haircut", "🪡 바느질 sewing",
      "🧵 실 thread", "🧶 뜨개 yarn", "🪆 인형 doll", "🛎️ 벨 bell service",
      "🧊 제빙 ice", "🪵 나무토막 wood", "🪴 반려식물 plant", "🪟 블라인드 blind",
    ],
  },
  {
    key: "health",
    label: "건강·운동",
    items: [
      "🏥 병원 hospital", "💊 약 약국 medicine pharmacy", "💉 주사 injection", "🩺 진료 검진 checkup",
      "🩻 엑스레이 xray", "🩹 반창고 bandage", "🦷 치과 dental", "👁️ 안과 eye",
      "👂 귀 ear", "👃 코 nose", "🧠 정신 brain", "🫀 심장 heart",
      "🫁 폐 lung", "🦴 뼈 bone", "🩸 헌혈 blood", "🦠 세균 virus",
      "😷 마스크 mask", "🧬 유전자 dna", "🔬 현미경 microscope", "⚕️ 의료 medical",
      "🏋️ 헬스 운동 gym workout", "🤸 체조 gymnastics", "🧘 요가 명상 yoga", "🤾 핸드볼 handball",
      "🏃 달리기 running", "🚶 걷기 walking", "🧎 무릎 kneel", "🕺 춤 dance",
      "💃 춤 dance", "🥊 복싱 boxing", "🥋 무술 태권도 martial", "🤺 펜싱 fencing",
      "🏊 수영 swimming", "🤽 수구 waterpolo", "🚴 사이클 cycling", "🚵 산악자전거 mtb",
      "⚽ 축구 soccer", "⚾ 야구 baseball", "🥎 소프트볼 softball", "🏀 농구 basketball",
      "🏐 배구 volleyball", "🏈 미식축구 football", "🏉 럭비 rugby", "🎾 테니스 tennis",
      "🏸 배드민턴 badminton", "🏓 탁구 pingpong", "🥍 라크로스 lacrosse", "🏑 하키 hockey",
      "🏒 아이스하키 hockey", "⛳ 골프 golf", "🎳 볼링 bowling", "🎿 스키 ski",
      "🛷 썰매 sled", "⛷️ 스키 ski", "🏂 스노보드 snowboard", "⛸️ 스케이트 skating",
      "🧗 클라이밍 climbing", "🏄 서핑 surfing", "🚣 조정 rowing", "🤿 다이빙 diving",
      "🎣 낚시 fishing", "🏅 메달 medal", "🥇 금메달 gold", "🥈 은메달 silver",
      "🥉 동메달 bronze", "🏆 트로피 trophy", "🎯 다트 목표 target", "🤼 레슬링 wrestling",
      "🛌 휴식 rest", "🧖 사우나 sauna", "💆 마사지 massage", "💇 미용실 haircut",
    ],
  },
  {
    key: "fun",
    label: "문화·취미",
    items: [
      "🎬 영화 movie", "🍿 팝콘 popcorn", "🎭 공연 연극 theater", "🎤 노래방 karaoke",
      "🎵 음악 music", "🎶 음표 notes", "🎧 이어폰 headphone", "🎼 악보 score",
      "🎸 기타 guitar", "🪕 밴조 banjo", "🎹 피아노 piano", "🥁 드럼 drum",
      "🪘 장구 drum", "🎺 트럼펫 trumpet", "🎷 색소폰 sax", "🎻 바이올린 violin",
      "🪗 아코디언 accordion", "📻 라디오 radio", "🎙️ 마이크 mic", "🔊 소리 sound",
      "🎮 게임 game", "🕹️ 오락 arcade", "🎲 보드게임 board", "🃏 카드 card",
      "🀄 마작 mahjong", "♟️ 체스 chess", "🧩 퍼즐 puzzle", "🎰 슬롯 slot",
      "📚 책 도서 book", "📖 독서 reading", "📓 공책 notebook", "📔 일기 diary",
      "📰 신문 news", "🗞️ 신문 paper", "✏️ 연필 pencil", "🖊️ 펜 pen",
      "🖋️ 만년필 fountain pen", "🖍️ 크레용 crayon", "🖌️ 붓 brush", "🎨 미술 art",
      "📷 사진 camera", "📸 촬영 photo", "🎥 영상 video", "📹 캠코더 camcorder",
      "📺 티비 tv", "🎞️ 필름 film", "🎪 서커스 circus", "🎠 회전목마 carousel",
      "🎉 파티 party", "🎊 축하 celebrate", "🎈 풍선 balloon", "🎇 불꽃 fireworks",
      "🎆 불꽃놀이 fireworks", "🪅 파티 pinata", "🪩 미러볼 disco", "🧸 인형 toy",
      "🪀 요요 yoyo", "🪁 연 kite", "🎽 마라톤 running", "🎗️ 리본 ribbon",
      "🎄 크리스마스 christmas", "🎍 새해 newyear", "🎎 인형 doll", "🎏 잉어 koi",
      "🎐 풍경 windchime", "🧨 폭죽 firecracker", "🪄 마술 magic", "🔮 점 crystal",
      "🧿 부적 amulet", "🎓 졸업 graduation", "📯 나팔 horn", "🛝 미끄럼틀 slide",
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
      "💎 보석 gem", "⚖️ 저울 균형 balance", "🪝 갈고리 hook", "📅 달력 일정 calendar",
      "🗓️ 일정 schedule", "⏰ 알람 alarm", "⏱️ 스톱워치 stopwatch", "⏳ 모래시계 hourglass",
      "⌛ 시간 time", "🕐 시각 clock", "📌 고정 pin", "📍 핀 pin",
      "📎 클립 clip", "🖇️ 클립 clips", "📁 폴더 folder", "📂 자료 file",
      "🗂️ 분류 index", "🗄️ 서랍 cabinet", "🗃️ 상자 box file", "📋 목록 clipboard",
      "📝 메모 note", "🗒️ 메모지 notepad", "📄 문서 document", "📃 종이 page",
      "📑 책갈피 bookmark tabs", "🧮 주판 abacus", "✉️ 편지 mail", "📧 이메일 email",
      "📨 받은 편지 mail", "📩 보낸 편지 mail", "📮 우편 post", "📪 우편함 mailbox",
      "📦 택배 배송 package delivery", "🖨️ 인쇄 print", "💻 노트북 laptop", "🖥️ 컴퓨터 desktop",
      "⌨️ 키보드 keyboard", "🖱️ 마우스 mouse", "💽 디스크 disk", "💾 저장 save",
      "💿 CD cd", "🗜️ 압축 compress", "📱 휴대폰 phone", "📲 모바일 mobile",
      "☎️ 전화 telephone", "📞 통화 call", "📠 팩스 fax", "🌐 인터넷 internet",
      "📡 통신 signal", "🛰️ 위성 satellite", "🔍 검색 search", "🔎 돋보기 search",
      "🔔 알림 bell", "🔕 알림 끔 mute", "🏢 회사 office", "💼 업무 가방 briefcase work",
      "🧑‍💻 개발 developer", "📶 데이터 통신 data", "🔐 보안 secure", "🗳️ 투표 vote",
      "📢 공지 announce", "📣 확성기 megaphone", "🧑‍💼 직장인 office worker", "🪪 신분증 id",
    ],
  },
  {
    key: "people",
    label: "사람·동물",
    items: [
      "🧑 사람 person", "👤 익명 anonymous", "👥 사람들 people", "🧑‍🦱 곱슬 curly",
      "👨 남자 man", "👩 여자 woman", "🧒 아이 child", "👶 아기 baby",
      "🧓 노인 elder", "👴 할아버지 grandpa", "👵 할머니 grandma", "🧔 수염 beard",
      "👨‍👩‍👧 가족 family", "👨‍👩‍👧‍👦 가족 family", "🧑‍🤝‍🧑 친구 friend", "💑 커플 couple",
      "💏 연인 kiss", "👰 결혼 wedding", "🤵 신랑 groom", "🤰 임신 pregnant",
      "🍼 육아 baby", "🧑‍🍳 요리사 chef", "🧑‍🏫 선생님 teacher", "🧑‍⚕️ 의사 doctor",
      "🧑‍🔧 정비 mechanic", "🧑‍🌾 농부 farmer", "🧑‍🎓 학생 졸업 student", "🧑‍🎨 화가 artist",
      "🧑‍🚒 소방관 firefighter", "🧑‍✈️ 조종사 pilot", "🧑‍🚀 우주인 astronaut", "🧑‍⚖️ 판사 judge",
      "🧑‍🔬 연구원 scientist", "🧑‍🏭 노동자 worker", "👮 경찰 police", "🕵️ 탐정 detective",
      "💂 근위병 guard", "👷 건설 노동자 worker", "🤴 왕자 prince", "👸 공주 princess",
      "🦸 영웅 hero", "🦹 악당 villain", "🧙 마법사 wizard", "🧚 요정 fairy",
      "🧛 뱀파이어 vampire", "🧜 인어 mermaid", "🧝 엘프 elf", "🎅 산타 santa",
      "🤶 산타 santa", "🐶 강아지 개 dog", "🐕 개 dog", "🦮 안내견 guide dog",
      "🐩 푸들 poodle", "🐺 늑대 wolf", "🦊 여우 fox", "🦝 너구리 raccoon",
      "🐱 고양이 cat", "🐈 고양이 cat", "🦁 사자 lion", "🐯 호랑이 tiger",
      "🐅 호랑이 tiger", "🐆 표범 leopard", "🐴 말 horse", "🐎 말 horse",
      "🦄 유니콘 unicorn", "🦓 얼룩말 zebra", "🦌 사슴 deer", "🦬 들소 bison",
      "🐮 소 cow", "🐂 황소 ox", "🐄 젖소 cow", "🐷 돼지 pig",
      "🐗 멧돼지 boar", "🐏 숫양 ram", "🐑 양 sheep", "🐐 염소 goat",
      "🐪 낙타 camel", "🦙 라마 llama", "🦒 기린 giraffe", "🐘 코끼리 elephant",
      "🦏 코뿔소 rhino", "🦛 하마 hippo", "🐭 쥐 mouse", "🐹 햄스터 hamster",
      "🐰 토끼 rabbit", "🐇 토끼 rabbit", "🐿️ 다람쥐 squirrel", "🦔 고슴도치 hedgehog",
      "🦇 박쥐 bat", "🐻 곰 bear", "🐨 코알라 koala", "🐼 판다 panda",
      "🦥 나무늘보 sloth", "🦦 수달 otter", "🦘 캥거루 kangaroo", "🐔 닭 chicken",
      "🐓 수탉 rooster", "🐣 병아리 chick", "🐤 병아리 chick", "🐦 새 bird",
      "🕊️ 비둘기 dove", "🦅 독수리 eagle", "🦆 오리 duck", "🦢 백조 swan",
      "🦉 부엉이 owl", "🦜 앵무새 parrot", "🦩 홍학 flamingo", "🐧 펭귄 penguin",
      "🐸 개구리 frog", "🐢 거북 turtle", "🦎 도마뱀 lizard", "🐍 뱀 snake",
      "🐊 악어 crocodile", "🐳 고래 whale", "🐬 돌고래 dolphin", "🦭 물개 seal",
      "🐟 물고기 fish", "🐠 열대어 fish", "🐡 복어 pufferfish", "🦈 상어 shark",
      "🐙 문어 octopus", "🐌 달팽이 snail", "🦋 나비 butterfly", "🐛 애벌레 caterpillar",
      "🐝 벌 bee", "🐞 무당벌레 ladybug", "🦗 귀뚜라미 cricket", "🕷️ 거미 spider",
      "🐾 반려동물 pet paw", "🦴 뼈 bone", "🪶 깃털 feather", "🐉 용 dragon",
    ],
  },
  {
    key: "symbol",
    label: "기호·기타",
    items: [
      "⭐ 별 즐겨찾기 star", "🌟 반짝 sparkle", "✨ 반짝임 sparkles", "💫 별똥 dizzy",
      "❤️ 하트 heart", "🧡 주황하트 heart", "💛 노랑하트 heart", "💚 초록하트 heart",
      "💙 파랑하트 heart", "💜 보라하트 heart", "🤎 갈색하트 heart", "🖤 검정하트 heart",
      "🤍 흰하트 heart", "💯 백점 100", "✅ 완료 check done", "☑️ 체크 check",
      "✔️ 체크 check", "❌ 취소 cancel", "❎ 취소 cross", "⛔ 금지 stop",
      "🚫 금지 no", "⚠️ 주의 warning", "❗ 중요 important", "❕ 느낌표 exclamation",
      "❓ 질문 question", "❔ 물음표 question", "💡 아이디어 idea", "🔥 인기 hot fire",
      "💧 물 water drop", "🌊 파도 wave", "🌈 무지개 rainbow", "☀️ 맑음 sun",
      "🌞 해 sun", "⛅ 구름 조금 cloud", "🌤️ 구름 cloud", "☁️ 흐림 cloudy",
      "🌥️ 흐림 cloudy", "🌦️ 소나기 shower", "🌧️ 비 rain", "⛈️ 폭우 storm",
      "🌩️ 번개 lightning", "⚡ 번개 전기 zap", "🌪️ 회오리 tornado", "🌫️ 안개 fog",
      "❄️ 눈 snow", "☃️ 눈사람 snowman", "⛄ 눈사람 snowman", "🌬️ 바람 wind",
      "🌙 달 밤 moon night", "🌚 달 moon", "🌝 보름달 moon", "🌛 달 moon",
      "🌜 달 moon", "🌕 보름달 fullmoon", "🌑 그믐 newmoon", "🌗 반달 moon",
      "🪐 토성 planet", "🌏 지구 earth", "🌎 지구 earth", "🌍 지구 earth",
      "🔴 빨강 red", "🟠 주황 orange", "🟡 노랑 yellow", "🟢 초록 green",
      "🔵 파랑 blue", "🟣 보라 purple", "🟤 갈색 brown", "⚫ 검정 black",
      "⚪ 하양 white", "🟥 빨강 네모 red", "🟧 주황 네모 orange", "🟨 노랑 네모 yellow",
      "🟩 초록 네모 green", "🟦 파랑 네모 blue", "🟪 보라 네모 purple", "⬛ 네모 square",
      "⬜ 흰 네모 square", "🔶 마름모 diamond", "🔷 마름모 diamond", "🔸 작은 마름모 diamond",
      "🔹 작은 마름모 diamond", "🔺 세모 triangle", "🔻 역삼각 triangle", "♦️ 다이아 diamond",
      "♠️ 스페이드 spade", "♥️ 하트 heart", "♣️ 클로버 club", "♻️ 재활용 recycle",
      "🔄 반복 repeat", "🔁 반복 loop", "🔂 한 곡 반복 repeat one", "🔀 섞기 shuffle",
      "▶️ 재생 play", "⏸️ 멈춤 pause", "⏹️ 정지 stop", "⏭️ 다음 next",
      "⏮️ 이전 previous", "⤴️ 위로 up", "⤵️ 아래로 down", "↩️ 되돌리기 undo",
      "↪️ 다시 redo", "🔝 위 top", "🔙 뒤로 back", "🔜 곧 soon",
      "🆕 신규 new", "🆓 무료 free", "🆗 확인 ok", "🆙 올림 up",
      "🈹 할인 discount", "🈳 빈자리 vacancy", "🎫 티켓 ticket", "🎟️ 입장권 ticket",
      "🏷️ 태그 라벨 tag", "🔖 북마크 bookmark", "📍 위치 location", "🗑️ 삭제 trash",
      "♾️ 무한 infinity", "〽️ 표시 mark", "🔱 삼지창 trident", "⚜️ 문장 fleur",
      "🅰️ 에이 a", "🅱️ 비 b", "🆎 에이비 ab", "🅾️ 오 o",
      "0️⃣ 영 zero", "1️⃣ 일 one", "2️⃣ 이 two", "3️⃣ 삼 three",
      "4️⃣ 사 four", "5️⃣ 오 five", "6️⃣ 육 six", "7️⃣ 칠 seven",
      "8️⃣ 팔 eight", "9️⃣ 구 nine", "🔟 십 ten", "#️⃣ 샵 hash",
    ],
  },
];

export type EmojiEntry = { char: string; keywords: string };

/** "이모지 검색어..." 한 줄을 쪼갠다. */
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

/** 검색어로 거른다. 비어 있으면 전체를 그대로 돌려준다. */
export function searchEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return EMOJI_ALL;
  return EMOJI_ALL.filter((e) => e.keywords.includes(q) || e.char === q);
}
