// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: brown; icon-glyph: magic;
// The script picks a random word from
// a given search to jisho.org for vocabulary practice
// -------

// cache words to try and not over-query
var wordCache = []
let widget = await createWidget()
// Check if the script is running in
// a widget. If not, show a preview of
// the widget to easier debug it.

if (!config.runsInWidget) {
    await widget.presentLarge()
}

// Tell the system to show the widget.
Script.setWidget(widget)
Script.complete()


async function createWidget() {

    // Adjust colors here if you'd like:
    const UPPER_LEFT_COLORS = { 
        light: '#fadbd9',
        dark: '#393939'
    }
    const UPPER_RIGHT_COLORS = { 
        light: '#d9fadb',
        dark: '#ff5a09'
    }
    const BOTTOM_LEFT_COLORS = { 
        light: '#faebd9',
        dark: '#00303f'
    }
    const BOTTOM_RIGHT_COLORS = { 
        light: '#f8fad9',
        dark: '#7a9d96'
    }

    let w = new ListWidget()
    
    let keyword = args.widgetParameter || '#jlpt-n1'
    
    
    const BOX_WIDTH = (widgetFamily => {
        switch (widgetFamily) {
            case 'small':
                return 170;
            case 'medium':
                return 185;
            case 'large':
                return 182;
            default:
                return 170;
        }
    })(config.widgetFamily);
    const BOX_HEIGHT = (widgetFamily => {
        switch (widgetFamily) {
            case 'small':
                return 170;
            case 'medium':
                return 170;
            case 'large':
                return 192;
            default:
                return 170;
        }
    })(config.widgetFamily);

    let topRow = w.addStack()
    let upperLeftOuter = topRow.addStack()
    upperLeftOuter.centerAlignContent()
    upperLeftOuter.setPadding(4,4,4,4)
    upperLeftOuter.size = new Size(BOX_WIDTH,BOX_HEIGHT)
    upperLeftOuter.backgroundColor = Color.dynamic(new Color(UPPER_LEFT_COLORS.light), new Color(UPPER_LEFT_COLORS.dark))
    await buildTextStack(keyword, upperLeftOuter.addStack())
    
    // only added if running in medium/large mode, second word
    if (config.widgetFamily === 'medium' || config.widgetFamily === 'large') {
        let upperRightOuter = topRow.addStack()
        upperRightOuter.backgroundColor = Color.dynamic(new Color(UPPER_RIGHT_COLORS.light), new Color(UPPER_RIGHT_COLORS.dark))
        upperRightOuter.setPadding(4,4,4,4)
        upperRightOuter.centerAlignContent()
        upperRightOuter.size = new Size(BOX_WIDTH,BOX_HEIGHT)
        await buildTextStack(keyword, upperRightOuter.addStack())
        
    }
    // only added if running in large mode, third and fourth words
    if (config.widgetFamily === 'large') {
        let bottomRow = w.addStack()
        let bottomLeftOuter = bottomRow.addStack()
        bottomLeftOuter.centerAlignContent()
        bottomLeftOuter.setPadding(4,4,4,4)
        bottomLeftOuter.size = new Size(BOX_WIDTH,BOX_HEIGHT)
        bottomLeftOuter.backgroundColor = Color.dynamic(new Color(BOTTOM_LEFT_COLORS.light), new Color(BOTTOM_LEFT_COLORS.dark))
        await buildTextStack(keyword, bottomLeftOuter.addStack())
        let bottomRightOuter = bottomRow.addStack()
        bottomRightOuter.centerAlignContent()
        bottomRightOuter.setPadding(4,4,4,4)
        bottomRightOuter.size = new Size(BOX_WIDTH,BOX_HEIGHT)
        bottomRightOuter.backgroundColor = Color.dynamic(new Color(BOTTOM_RIGHT_COLORS.light), new Color(BOTTOM_RIGHT_COLORS.dark))
        await buildTextStack(keyword, bottomRightOuter.addStack())
    }
    return w
}
async function buildTextStack(keyword, stack) {
    randomWord = await fetchRandomWord(keyword)
    // often there are more than one "words" matching a given result, without knowing for sure the best
    // we propose a heuristic to pick the one most likely to be applicable is the one with 
    // multiple english definitions.  This helps avoid proper names from appearing.  Area for more research.
    senseIndex = pickDefinition(randomWord)
    stack.url = 'https://jisho.org/word/' + encodeURIComponent(randomWord.slug)
    stack.layoutVertically()
    // "furigana" / reading
    reading = stack.addText(randomWord.japanese[0].reading)
    reading.font = Font.footnote()
    // word in Japanese or its slug (search key) if it's katakana
    word = stack.addText(randomWord.japanese[0].word ? randomWord.japanese[0].word : randomWord.slug)
    word.font = Font.title2()
    // chosen english definition(s)
    stack.addText(randomWord.senses[senseIndex].english_definitions.join('; '))
}
async function fetchRandomWord(keyword) {
    if(wordCache.length > 0) return wordCache.pop()

    const APPROX_MAX_PAGES = (searchKey => {
        switch (searchKey) {
            // below numbers based on max pages returned as of Jan 2021
            case '#jlpt-n1':
                return 175;
            case '#jlpt-n2':
                return 95;
            case '#jlpt-n3':
                return 95;
            case '#jlpt-n4':
                return 35;
            case '#jlpt-n5':
                return 38;
            default:
                // no particular reason for this, with arbitrary search keywords it's hard to say
                return 30;
        }
    })(keyword);

    for (i = 1; i < 6; i++) {
        try {
            // since jisho currently doesn't return max pages on a search, we need to guess, and try to find enough words within 5 guesses
            // idea here is to start at a random page, but as attempt count (i) rises, aggressively move towards page = 1
            // TODO: completely rewrite once jisho api returns max pages for a search result
            const randomPg = i === 5 ? 1 : (1 + Math.floor((Math.random() * APPROX_MAX_PAGES) / i))
            let r = new Request("https://jisho.org/api/v1/search/words?keyword=" + encodeURIComponent(keyword) + "&page=" + randomPg)
            
            const json = await r.loadJSON()
            if (json.data.length > 0) {
                randomIndexes = []
                while(randomIndexes.length < json.data.length) {
                    const c = Math.floor(Math.random() * json.data.length)
                    if(randomIndexes.indexOf(c) === -1) randomIndexes.push(c);
                } 
            
                while(randomIndexes.length > 0) {
                    wordCache.push(json.data[randomIndexes.pop()])
                }   
                return wordCache.pop()
            } else {
                throw Error('Data was not populated, empty page?')
            }
        } catch { }
    }
}

function pickDefinition(randomWord) {
    if(! randomWord || randomWord.japanese.length === 1 || randomWord.senses.length === 1) {
        return 0
    }
    // looking at examples, it seems like the best picks are words with multiple english definitions
    for(i = 0; i<randomWord.senses.length; i++) {
        if(randomWord.senses[i].english_definitions.length > 1) {
            return i
        } 
    }
    return 0
}