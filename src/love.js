'use strict';
// Love Quiz question bank. Server-only: the answer is never sent until the question is done.
// Same format as the Bible Quiz (see bible.js): an illustrated scene, a question, four options.
// `ref` here is a short "Did you know?" fact shown after the answer.
//
// Romantic backdrops: sunset, rosegarden, dinner, balcony, wedding, city (plus every Bible Quiz backdrop)
// Romantic effects:   hearts, petals, sparkle (plus every Bible Quiz effect)

const E = (t, x, y, s = 48, o = {}) => ({ k: 't', t, x, y, s, ...o });
const Ln = (d, c = '#6B4A2B', w = 6) => ({ k: 'p', d, c, w });
const Q = (q, a, c, h, ref) => ({ q, a, c, h, ...(ref ? { ref } : {}) });
// scene(backdrop, effects, emoji, [first question, second question])
const scene = (s, fx, e, qs) => ({ s, fx, e, qs });

const CRUSH = [
  scene('rosegarden', ['hearts'], [E('👼', 120, 120, 70), E('🏹', 186, 136, 54, { r: -20 }), E('💘', 248, 86, 40)], [
    Q('Which winged figure shoots arrows to make people fall in love?', 'Cupid', ['Hermes', 'Pegasus', 'Gabriel'], 'The Roman god of desire.', 'In Greek myths he is called Eros.'),
    Q('On which date is Valentine’s Day?', '14 February', ['1 May', '25 December', '29 February'], 'The middle of the shortest month.', 'It is named after St Valentine, a Roman martyr.')]),
  scene('rosegarden', ['petals'], [E('🌹', 150, 150, 120), E('🎀', 150, 226, 44)], [
    Q('Which colour of rose traditionally means romantic love?', 'Red', ['Yellow', 'White', 'Black'], 'Look at the picture.', 'Yellow roses usually mean friendship.'),
    Q('How many roses are in a classic “dozen”?', 'Twelve', ['Ten', 'Six', 'Twenty'], 'Also the number of months in a year.', 'A single red rose is said to mean “love at first sight”.')]),
  scene('rosegarden', ['hearts', 'sparkle'], [E('💌', 150, 150, 110), E('✍️', 236, 222, 40)], [
    Q('What do “XOXO” at the end of a message mean?', 'Hugs and kisses', ['See you soon', 'Good night', 'Call me'], 'Two kinds of affection, repeated.', 'X is usually the kiss and O the hug.'),
    Q('Which shape is the best-known symbol of love?', 'A heart', ['A star', 'A circle', 'A diamond'], 'Look around the envelope.', 'The heart shape has stood for love since the Middle Ages.')]),
  scene('wedding', ['petals'], [E('💍', 150, 140, 96), E('👰', 96, 222, 52), E('🤵', 204, 222, 52)], [
    Q('In many countries, on which finger is a wedding ring worn?', 'The ring finger', ['The thumb', 'The index finger', 'The little finger'], 'The fourth finger.', 'An old belief said a vein ran from it straight to the heart.'),
    Q('Who stands beside the groom and gives a speech at many weddings?', 'The best man', ['The usher', 'The page boy', 'The bridesmaid'], 'He is usually the groom’s closest friend.')]),
  scene('sunset', ['hearts'], [E('👫', 150, 186, 74)], [
    Q('Complete the phrase: “Love at first …”', 'sight', ['dance', 'date', 'word'], 'It happens the moment you see them.'),
    Q('What does it mean to “tie the knot”?', 'Get married', ['Break up', 'Go on a first date', 'Move house'], 'It is a promise, not a shoelace.', 'Some ceremonies really do tie the couple’s hands together.')]),
  scene('dinner', ['sparkle'], [E('🍫', 110, 172, 70), E('🎁', 206, 170, 60), E('💝', 150, 92, 46)], [
    Q('Which sweet treat is the most popular Valentine’s gift?', 'Chocolate', ['Ice cream', 'Popcorn', 'Cake'], 'Look at the picture.'),
    Q('In which country do women give chocolate to men on Valentine’s Day?', 'Japan', ['France', 'Brazil', 'Kenya'], 'An Asian country.', 'Men return the favour a month later, on “White Day”.')]),
  scene('wedding', ['hearts'], [E('💒', 150, 130, 100), E('🔔', 70, 70, 36), E('🔔', 230, 70, 36, { flip: true })], [
    Q('What is a “honeymoon”?', 'A holiday after the wedding', ['The wedding cake', 'The engagement party', 'The first date'], 'It comes after the big day.'),
    Q('Which two words are famously said during a wedding?', '“I do”', ['“Cheers”', '“Amen”', '“Thank you”'], 'An answer to “Do you take…?”')]),
  scene('balcony', ['stars', 'moon'], [E('🎸', 96, 236, 54), E('🧑', 60, 236, 46), E('👩', 222, 180, 46), E('🎶', 150, 150, 34)], [
    Q('What is it called when someone sings to their love under a window?', 'A serenade', ['A lullaby', 'An anthem', 'A chorus'], 'It is usually done at night.'),
    Q('Which instrument is the classic choice for a serenade?', 'A guitar', ['A drum kit', 'A tuba', 'A church organ'], 'Look at the picture.')]),
  scene('river', ['hearts'], [E('🦢', 116, 210, 64), E('🦢', 186, 210, 64, { flip: true }), E('💞', 150, 140, 36)], [
    Q('Which elegant birds are known for pairing up for life?', 'Swans', ['Ducks', 'Flamingos', 'Pigeons'], 'Look at the picture.', 'Two swans facing each other make a heart with their necks.'),
    Q('What kind of birds are “lovebirds”?', 'Small parrots', ['Pigeons', 'Sparrows', 'Owls'], 'They come from Africa and are very colourful.', 'They got the name because pairs sit close together for hours.')]),
  scene('sunset', ['sparkle'], [E('🧎', 104, 214, 60), E('💍', 158, 186, 36), E('😲', 214, 168, 54), E('💐', 236, 222, 36)], [
    Q('What is happening when someone kneels on one knee holding a ring?', 'A proposal', ['A prayer', 'An apology', 'A magic trick'], 'A question that changes everything.'),
    Q('What is a couple called after the proposal but before the wedding?', 'Engaged', ['Divorced', 'Retired', 'Adopted'], 'They now have a ring.')]),
];

const DATE_NIGHT = [
  scene('sea', ['waves', 'sparkle'], [E('🚢', 140, 180, 100), E('🧊', 252, 196, 54), E('👫', 112, 146, 28)], [
    Q('In which film do Jack and Rose fall in love on a doomed ship?', 'Titanic', ['The Notebook', 'Pearl Harbor', 'Casablanca'], 'The ship hit an iceberg in 1912.', 'It won 11 Oscars, a record it shares with two other films.'),
    Q('Who sang “My Heart Will Go On” from Titanic?', 'Céline Dion', ['Whitney Houston', 'Mariah Carey', 'Adele'], 'A Canadian singer.')]),
  scene('river', ['rain'], [E('💏', 150, 176, 90), E('🛶', 236, 232, 50), E('🌧️', 70, 60, 40)], [
    Q('Which film features Noah and Allie and a famous kiss in the rain?', 'The Notebook', ['Titanic', 'La La Land', 'Twilight'], 'It starts with an old man reading to a woman.'),
    Q('Who wrote the novel “The Notebook”?', 'Nicholas Sparks', ['Jane Austen', 'Stephen King', 'John Green'], 'He also wrote “A Walk to Remember”.')]),
  scene('night', ['stars', 'sparkle'], [E('🏰', 150, 130, 100), E('👠', 108, 236, 44), E('🕛', 236, 66, 40), E('🎃', 58, 236, 36)], [
    Q('Which fairy-tale heroine loses a glass slipper at the ball?', 'Cinderella', ['Snow White', 'Rapunzel', 'Ariel'], 'Her carriage was a pumpkin.'),
    Q('At what time does Cinderella’s magic wear off?', 'Midnight', ['Noon', 'Sunrise', 'Ten o’clock'], 'Look at the clock.')]),
  scene('palace', ['glow', 'sparkle'], [E('🌹', 150, 150, 84), Ln('M104 210 Q104 96 150 90 Q196 96 196 210 Z', '#D6E9F5', 4), E('🕯️', 60, 230, 34), E('🫖', 240, 230, 34)], [
    Q('In which story does a young woman fall in love with a cursed beast?', 'Beauty and the Beast', ['The Little Mermaid', 'Frozen', 'Tangled'], 'Her name is Belle.'),
    Q('What has to fall from the enchanted rose before the curse is permanent?', 'Its last petal', ['Its thorns', 'Its leaves', 'Its stem'], 'Look at the rose under the glass.')]),
  scene('city', ['stars'], [E('🎹', 150, 220, 76), E('💃', 80, 156, 48), E('🕺', 220, 156, 48)], [
    Q('Which musical follows a jazz pianist and an actress chasing their dreams?', 'La La Land', ['Grease', 'Mamma Mia!', 'The Greatest Showman'], 'It was released in 2016.'),
    Q('Which city is “La La Land” set in?', 'Los Angeles', ['Las Vegas', 'London', 'Lagos'], 'The home of Hollywood.')]),
  scene('palace', ['hearts'], [E('🎤', 150, 160, 86), E('🎶', 76, 100, 38), E('🎶', 226, 120, 34)], [
    Q('Who sang the hit version of “I Will Always Love You” in “The Bodyguard”?', 'Whitney Houston', ['Céline Dion', 'Beyoncé', 'Tina Turner'], 'She also starred in the film.'),
    Q('Who first wrote and recorded “I Will Always Love You”?', 'Dolly Parton', ['Whitney Houston', 'Aretha Franklin', 'Diana Ross'], 'A country music star.', 'She wrote it in 1973 as a goodbye to her business partner.')]),
  scene('city', ['sparkle'], [E('💍', 150, 130, 90), E('💃', 80, 214, 48), E('💃', 220, 214, 48, { flip: true })], [
    Q('Complete the Beyoncé lyric: “If you liked it then you should have put a … on it.”', 'ring', ['bow', 'lock', 'crown'], 'Look at the picture.'),
    Q('Which singer released the wedding favourite “Perfect” in 2017?', 'Ed Sheeran', ['Bruno Mars', 'John Legend', 'Sam Smith'], 'A red-haired English singer.')]),
  scene('balcony', ['stars', 'moon'], [E('👩', 196, 176, 48), E('🧑', 84, 238, 48), E('🧪', 248, 230, 28), E('🗡️', 40, 236, 30, { r: 40 })], [
    Q('Which star-crossed lovers came from feuding families in Verona?', 'Romeo and Juliet', ['Antony and Cleopatra', 'Tristan and Isolde', 'Pyramus and Thisbe'], 'She asks where he is from her balcony.'),
    Q('Who wrote “Romeo and Juliet”?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Oscar Wilde'], 'An English playwright from Stratford.')]),
  scene('garden', ['sun'], [E('🏡', 220, 160, 70), E('👗', 92, 200, 54), E('🎩', 150, 196, 40), E('📖', 150, 252, 32)], [
    Q('Which novel tells the story of Elizabeth Bennet and Mr Darcy?', 'Pride and Prejudice', ['Jane Eyre', 'Emma', 'Wuthering Heights'], 'It was published in 1813.'),
    Q('Who wrote “Pride and Prejudice”?', 'Jane Austen', ['Charlotte Brontë', 'Emily Brontë', 'George Eliot'], 'She also wrote “Emma”.')]),
  scene('palace', [], [E('🎬', 150, 96, 60), E('🍿', 100, 218, 50), E('🥤', 200, 218, 44), E('❤️', 150, 166, 30)], [
    Q('In which film does a famous actress fall for a London bookshop owner?', 'Notting Hill', ['Pretty Woman', 'Love Actually', 'Runaway Bride'], 'It is named after a part of London.'),
    Q('Which Christmas film has a love note written on cards: “To me, you are perfect”?', 'Love Actually', ['The Holiday', 'Notting Hill', 'Elf'], 'It follows many couples at once.')]),
];

const SWEETHEART = [
  scene('river', ['sun'], [E('🕌', 150, 140, 110), E('💕', 236, 80, 36)], [
    Q('Which famous monument was built by an emperor in memory of his wife?', 'The Taj Mahal', ['The Eiffel Tower', 'The Colosseum', 'Big Ben'], 'It is in Agra, India.', 'It took about 20,000 workers some 20 years to build.'),
    Q('Which emperor built the Taj Mahal for Mumtaz Mahal?', 'Shah Jahan', ['Akbar', 'Babur', 'Aurangzeb'], 'A Mughal emperor.')]),
  scene('desert', ['sun'], [E('🔺', 230, 160, 70), E('👑', 110, 110, 44), E('👸', 110, 170, 60), E('🐍', 60, 238, 36)], [
    Q('Which Egyptian queen had a famous love affair with Mark Antony?', 'Cleopatra', ['Nefertiti', 'Hatshepsut', 'The Queen of Sheba'], 'The last ruler of Ptolemaic Egypt.'),
    Q('Which Roman leader was Cleopatra’s partner before Mark Antony?', 'Julius Caesar', ['Augustus', 'Nero', 'Brutus'], 'He was killed on the Ides of March.')]),
  scene('city', ['hearts'], [E('🗼', 150, 130, 120), E('🔒', 76, 236, 36), E('🔒', 120, 246, 30), E('🔐', 210, 240, 34)], [
    Q('Which city is often called the “City of Love”?', 'Paris', ['Rome', 'Venice', 'Vienna'], 'Look at the tower.'),
    Q('What were the padlocks couples fixed to bridges in Paris called?', 'Love locks', ['Heart keys', 'Kiss chains', 'Promise bolts'], 'Look at the bottom of the picture.', 'One bridge’s railings were removed in 2015 because of the weight.')]),
  scene('river', ['moon', 'stars'], [E('🛶', 150, 214, 80), E('👫', 150, 182, 36), E('🌉', 150, 100, 70)], [
    Q('In which Italian city do couples ride gondolas along the canals?', 'Venice', ['Florence', 'Milan', 'Naples'], 'A city built on water.'),
    Q('Legend says couples who kiss under which Venice bridge at sunset will love forever?', 'The Bridge of Sighs', ['The Rialto Bridge', 'Golden Gate Bridge', 'Tower Bridge'], 'Its name sounds sad.')]),
  scene('palace', ['sparkle'], [E('👑', 150, 70, 46), E('👰', 116, 180, 64), E('🤵', 186, 180, 64), E('🇬🇧', 246, 246, 30)], [
    Q('In which year did Prince William marry Catherine Middleton?', '2011', ['2005', '2015', '2018'], 'About two billion people watched.'),
    Q('Which American actress married Prince Harry in 2018?', 'Meghan Markle', ['Kate Hudson', 'Anne Hathaway', 'Emma Stone'], 'She starred in the TV series “Suits”.')]),
  scene('city', [], [E('🏛️', 150, 120, 90), E('👫', 150, 214, 60), E('🇺🇸', 246, 246, 30)], [
    Q('How did Michelle Robinson meet Barack Obama at a Chicago law firm?', 'She was his mentor', ['He was her boss', 'They were neighbours', 'They were classmates'], 'She was asked to guide the new summer associate.'),
    Q('Which Spike Lee film did Barack and Michelle Obama see on their first date?', 'Do the Right Thing', ['Malcolm X', 'Jungle Fever', 'She’s Gotta Have It'], 'It came out in 1989.')]),
  scene('garden', ['hearts', 'sun'], [E('👴🏿', 112, 200, 64), E('👵🏿', 188, 200, 64), E('🎂', 150, 250, 34), E('🌍', 150, 80, 40)], [
    Q('Nelson Mandela married Graça Machel on which special day?', 'His 80th birthday', ['Christmas Day', 'Independence Day', 'New Year’s Day'], 'Look at the cake.', 'They married on 18 July 1998.'),
    Q('Graça Machel had earlier been First Lady of which country?', 'Mozambique', ['Angola', 'Zimbabwe', 'Tanzania'], 'A country on Africa’s east coast.')]),
  scene('palace', ['sparkle'], [E('🎤', 110, 170, 60), E('🎤', 190, 170, 60, { flip: true }), E('🐝', 66, 80, 30), E('💿', 236, 80, 36)], [
    Q('Which couple released the joint album “Everything Is Love” in 2018?', 'Beyoncé and Jay-Z', ['Rihanna and Drake', 'Ciara and Russell Wilson', 'Kim and Kanye'], 'They called themselves The Carters.'),
    Q('Which country singer married June Carter, co-writer of “Ring of Fire”?', 'Johnny Cash', ['Elvis Presley', 'Willie Nelson', 'Kenny Rogers'], 'He was known as “The Man in Black”.')]),
  scene('feast', ['glow'], [E('🧪', 104, 176, 60), E('⚗️', 196, 176, 60), E('🏅', 150, 90, 46), E('👫', 150, 246, 40)], [
    Q('Which married scientists shared the 1903 Nobel Prize in Physics?', 'Marie and Pierre Curie', ['The Wright brothers', 'Watson and Crick', 'Albert and Mileva Einstein'], 'They studied radioactivity.'),
    Q('Which element did the Curies name after Marie’s home country?', 'Polonium', ['Radium', 'Uranium', 'Francium'], 'She was born in Warsaw.')]),
  scene('dinner', ['sparkle'], [E('💎', 150, 130, 100), E('💍', 150, 220, 50)], [
    Q('Which company’s 1947 advert made “A diamond is forever” famous?', 'De Beers', ['Tiffany & Co.', 'Cartier', 'Rolex'], 'A diamond mining company.'),
    Q('Who is credited with the first recorded diamond engagement ring, in 1477?', 'Archduke Maximilian of Austria', ['Napoleon', 'Henry VIII', 'Louis XIV'], 'He gave it to Mary of Burgundy.')]),
];

const SOULMATE = [
  scene('dinner', ['sparkle'], [E('🎂', 150, 160, 96), E('🥈', 70, 90, 44), E('🥂', 230, 90, 44)], [
    Q('Which wedding anniversary is the “silver” anniversary?', 'The 25th', ['The 10th', 'The 40th', 'The 50th'], 'A quarter of a century.'),
    Q('Which wedding anniversary is the “golden” one?', 'The 50th', ['The 25th', 'The 30th', 'The 60th'], 'Half a century.')]),
  scene('dinner', ['hearts'], [E('📜', 100, 170, 70), E('💎', 210, 170, 64), E('🎉', 150, 80, 40)], [
    Q('What is the traditional gift for a 1st wedding anniversary?', 'Paper', ['Cotton', 'Tin', 'Crystal'], 'Look at the scroll.'),
    Q('Which wedding anniversary is celebrated with diamonds?', 'The 60th', ['The 40th', 'The 50th', 'The 35th'], 'A very long marriage.')]),
  scene('city', ['hearts'], [E('🌍', 150, 150, 100), E('💬', 70, 80, 40), E('💬', 232, 92, 40, { flip: true }), E('🗨️', 90, 232, 34)], [
    Q('How do you say “I love you” in French?', 'Je t’aime', ['Te quiero', 'Ich liebe dich', 'Ti amo'], 'The language of Paris.'),
    Q('“Ti amo” means “I love you” in which language?', 'Italian', ['Spanish', 'Portuguese', 'Greek'], 'The language of Venice.')]),
  scene('rosegarden', ['sun'], [E('🌷', 90, 190, 70), E('🪻', 160, 196, 64), E('💐', 226, 186, 66)], [
    Q('In the language of flowers, what do forget-me-nots stand for?', 'True love and remembrance', ['Jealousy', 'Goodbye', 'Wealth'], 'Their name is a clue.'),
    Q('In the language of flowers, what do red tulips say?', '“I love you”', ['“I’m sorry”', '“Good luck”', '“Get well soon”'], 'They are red, like roses.')]),
  scene('wedding', ['petals'], [E('👰', 150, 160, 100), E('💙', 236, 92, 36), E('🎂', 64, 230, 40)], [
    Q('Complete the rhyme: “Something old, something new, something borrowed, something …”', 'blue', ['true', 'gold', 'sweet'], 'Look at the heart.'),
    Q('Which queen made white wedding dresses fashionable in 1840?', 'Queen Victoria', ['Elizabeth I', 'Marie Antoinette', 'Queen Anne'], 'She married Prince Albert.')]),
  scene('garden', ['hearts'], [E('🧹', 150, 230, 70, { r: 90 }), E('👫', 150, 150, 74), E('🎉', 240, 70, 36)], [
    Q('Which wedding tradition has the couple jump over something together?', 'Jumping the broom', ['Breaking the glass', 'Throwing the bouquet', 'Cutting the rope'], 'Look at the ground.'),
    Q('At Jewish weddings, what does the groom traditionally break with his foot?', 'A glass', ['A plate', 'A stick', 'An egg'], 'Guests shout “Mazel tov!”')]),
  scene('town', ['sun'], [E('🚪', 150, 150, 90), E('✊', 214, 150, 40), E('🍾', 70, 232, 40), E('👨‍👩‍👧', 236, 238, 40)], [
    Q('In Ghana, what is the groom’s family’s first formal visit to the bride’s family called?', 'The knocking ceremony', ['The outdooring', 'The durbar', 'Homowo'], 'Look at the door.', 'Drinks and gifts are presented to ask for the bride’s hand.'),
    Q('Which colourful handwoven cloth is often worn at Ghanaian weddings?', 'Kente', ['Tartan', 'Denim', 'Tweed'], 'Woven in strips by Asante and Ewe weavers.')]),
  scene('heaven', ['hearts', 'sparkle'], [E('🧠', 110, 150, 70), E('💗', 200, 150, 70), E('💋', 150, 240, 40)], [
    Q('Which hormone is often called the “love hormone” or “cuddle hormone”?', 'Oxytocin', ['Adrenaline', 'Insulin', 'Melatonin'], 'It is released during hugs.'),
    Q('What does “philematology” study?', 'Kissing', ['Hugging', 'Dating', 'Weddings'], 'Look at the bottom of the picture.')]),
  scene('sea', ['sun', 'sparkle'], [E('🐚', 150, 196, 90), E('🏛️', 236, 120, 50), E('🕊️', 66, 100, 40)], [
    Q('Who is the Greek goddess of love?', 'Aphrodite', ['Athena', 'Hera', 'Artemis'], 'She was born from the sea foam.'),
    Q('What is the Roman name for the goddess of love?', 'Venus', ['Juno', 'Minerva', 'Diana'], 'A planet is named after her.')]),
  scene('heaven', ['light'], [E('📖', 150, 150, 100), E('❤️', 150, 86, 40), E('🕊️', 236, 220, 40)], [
    Q('“Love is patient, love is kind” comes from which book of the Bible?', '1 Corinthians', ['Psalms', 'Proverbs', 'Romans'], 'A letter from Paul.', 'It is 1 Corinthians 13, often read at weddings.'),
    Q('Which book of the Bible is a collection of love poems?', 'Song of Songs', ['Lamentations', 'Job', 'Ecclesiastes'], 'It is also called the Song of Solomon.')]),
];

const LEGEND = [
  scene('town', ['hearts'], [E('⛓️', 70, 150, 50), E('🧔', 150, 170, 70), E('💌', 234, 150, 50), E('🏛️', 150, 64, 40)], [
    Q('St Valentine is said to have secretly married couples against which emperor’s orders?', 'Claudius II', ['Nero', 'Augustus', 'Constantine'], 'He thought single men made better soldiers.'),
    Q('Which English poet’s work first linked Valentine’s Day with romance?', 'Geoffrey Chaucer', ['William Shakespeare', 'John Milton', 'Lord Byron'], 'He wrote “The Canterbury Tales”.')]),
  scene('heaven', ['light', 'sparkle'], [E('👼', 104, 120, 64), E('👩', 196, 150, 64), E('🦋', 236, 70, 34), E('🏺', 70, 236, 34)], [
    Q('In Greek myth, which mortal woman was loved by Eros?', 'Psyche', ['Helen', 'Penelope', 'Medusa'], 'Her name means “soul”.'),
    Q('Which musician went into the underworld to bring back his wife, Eurydice?', 'Orpheus', ['Hercules', 'Perseus', 'Theseus'], 'He must not look back.')]),
  scene('desert', ['fire'], [E('🐴', 150, 160, 110), E('🏰', 246, 160, 56), E('👸', 60, 220, 46)], [
    Q('Whose elopement with Paris started the Trojan War?', 'Helen of Troy', ['Penelope', 'Andromache', 'Cassandra'], 'The face that launched a thousand ships.'),
    Q('Which faithful wife waited twenty years for Odysseus?', 'Penelope', ['Helen', 'Circe', 'Calypso'], 'She wove and unwove a shroud each day.')]),
  scene('palace', [], [E('👑', 112, 150, 70), E('➡️', 170, 150, 34), E('💍', 228, 150, 56), E('🇬🇧', 70, 246, 30), E('🇺🇸', 230, 246, 30)], [
    Q('Which British king gave up the throne in 1936 to marry Wallis Simpson?', 'Edward VIII', ['George VI', 'George V', 'Edward VII'], 'He reigned for less than a year.'),
    Q('Grace Kelly gave up acting to marry the prince of which country?', 'Monaco', ['Liechtenstein', 'Luxembourg', 'Sweden'], 'A tiny country on the French Riviera.')]),
  scene('city', ['sparkle'], [E('💍', 104, 150, 60), E('💍', 196, 150, 60), E('🎬', 150, 80, 44), E('💔', 150, 230, 36)], [
    Q('Which actress married Richard Burton twice?', 'Elizabeth Taylor', ['Marilyn Monroe', 'Audrey Hepburn', 'Grace Kelly'], 'She starred in “Cleopatra” with him.'),
    Q('How many times in total was Elizabeth Taylor married?', 'Eight', ['Three', 'Five', 'Ten'], 'More than five, fewer than ten.')]),
  scene('storm', ['wind', 'clouds'], [E('🏚️', 210, 186, 70), E('🧑', 90, 214, 50), E('👩', 136, 214, 50), E('🌿', 40, 252, 30)], [
    Q('Which novel tells of the stormy love of Heathcliff and Catherine?', 'Wuthering Heights', ['Jane Eyre', 'Rebecca', 'Middlemarch'], 'Set on the Yorkshire moors.'),
    Q('Who wrote “Jane Eyre”?', 'Charlotte Brontë', ['Emily Brontë', 'Anne Brontë', 'Jane Austen'], 'Emily’s older sister.')]),
  scene('sea', ['waves', 'sparkle'], [E('⛵', 150, 170, 90), E('🧪', 70, 100, 44), E('💞', 230, 92, 36)], [
    Q('In the medieval legend, what makes Tristan and Isolde fall in love?', 'A love potion', ['An arrow', 'A song', 'A dream'], 'Look at the bottle.'),
    Q('Which knight’s love for Queen Guinevere helped bring down Camelot?', 'Lancelot', ['Gawain', 'Galahad', 'Percival'], 'He was King Arthur’s best knight.')]),
  scene('town', ['moon'], [E('💌', 150, 150, 80), E('🏰', 236, 120, 50), E('⛓️', 70, 216, 40)], [
    Q('Which ancient Roman festival in mid-February is linked to Valentine’s Day?', 'Lupercalia', ['Saturnalia', 'Floralia', 'Vestalia'], 'It was held on 15 February.'),
    Q('Where was Charles, Duke of Orléans, when he wrote one of the oldest known valentines in 1415?', 'Imprisoned in the Tower of London', ['On a ship to India', 'At a wedding in Paris', 'In a monastery'], 'He had been captured at Agincourt.')]),
  scene('town', ['moon', 'stars'], [Ln('M150 120 L144 150 L156 170 L148 200', '#3B2F2A', 4), E('🧑', 90, 170, 54), E('👩', 210, 170, 54, { flip: true }), E('🦁', 252, 250, 34)], [
    Q('In the ancient tale, Pyramus and Thisbe whispered to each other through what?', 'A crack in a wall', ['A keyhole', 'A hollow tree', 'A well'], 'Look between them.'),
    Q('Which Shakespeare play includes a comic performance of “Pyramus and Thisbe”?', 'A Midsummer Night’s Dream', ['Twelfth Night', 'Much Ado About Nothing', 'The Tempest'], 'Fairies and a man with a donkey’s head.')]),
  scene('palace', ['glow'], [E('🎩', 110, 120, 60), E('✉️', 196, 140, 56), E('⚔️', 150, 220, 40), E('🌹', 236, 232, 30)], [
    Q('Which French emperor wrote passionate love letters to his wife Joséphine?', 'Napoleon Bonaparte', ['Louis XIV', 'Charlemagne', 'Louis XVI'], 'He lost at Waterloo.'),
    Q('Which British admiral’s love affair with Emma Hamilton was a famous scandal?', 'Horatio Nelson', ['Francis Drake', 'Walter Raleigh', 'James Cook'], 'He died at Trafalgar.')]),
];

// One pool entry per question; both questions of a scene share its picture (`story`), so a round never repeats a picture.
const expand = scenes => scenes.flatMap((sc, k) => sc.qs.map(q => ({ s: sc.s, fx: sc.fx, e: sc.e, ...q, story: k })));

const LEVELS = [
  { name: 'Crush', blurb: 'Valentine’s basics', pool: expand(CRUSH), mult: 1, maxHints: 2 },
  { name: 'Date Night', blurb: 'Love songs and films', pool: expand(DATE_NIGHT), mult: 1.5, maxHints: 2 },
  { name: 'Sweetheart', blurb: 'Famous couples', pool: expand(SWEETHEART), mult: 2, maxHints: 2 },
  { name: 'Soulmate', blurb: 'Traditions around the world', pool: expand(SOULMATE), mult: 2.5, maxHints: 2 },
  { name: 'Legend', blurb: 'Myths and history. One hint only', pool: expand(LEGEND), mult: 3, maxHints: 1 },
];

module.exports = { LEVELS };
