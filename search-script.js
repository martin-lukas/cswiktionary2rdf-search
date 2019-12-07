const DEFAULT_ENDPOINT = "https://cs.dbpedia.org/sparql";

let currentRow;
let baseMap;

function sendRequest() {
    currentRow = 0;
    baseMap = {};

    let word = document.getElementById("word").value;
    document.getElementById("hidden-table").style.display = "block";
    document.getElementById("tbody").innerHTML = "";
    extract(word.trim());
    console.log("Extraction FINISHED");
}

function extract(word) {
    let title = document.getElementById("title");
    let resources = getResources(word);
    title.innerHTML = "<b>Výskyty pro \'" + word + "\':</b>";
    for (let i = 0; i < resources.length; i++) {
        console.log("Extracting resource: " + resources[i]);
        extractResource(resources[i]);
    }
}

function getResources(word) {
    let resQuery =
        PREFIXES +
        'SELECT ?res ' +
        'WHERE { ' +
        '    ?res rdfs:label \"' + word + '\"@cs ;' +
        '         a          lemon:LexicalEntry .' +
        '} ';
    let results = getResults(resQuery);
    let resources = [];
    if (results.length > 0) {
        for (let i = 0; i < results.length; i++) {
            resources.push(getValue(results[i], "res"));
        }
    }
    return resources;
}

function getResults(query) {
    let params = "?query=" + encodeURIComponent(query) + "&format=json";

    let result;
    let http = new XMLHttpRequest();
    http.open("GET", DEFAULT_ENDPOINT + params, false);
    http.onreadystatechange = function () {
        if (http.readyState === 4) {
            result = http.responseText;
        }
    };
    http.send();
    let results;
    if (result !== undefined) {
        let resultObj = JSON.parse(result);
        results = resultObj["results"]["bindings"];
    }
    if (results === undefined || results === null) {
        results = [];
    }
    return results;
}

function extractResource(resource) {
    let baseObj = getBase(resource);
    let base = baseObj["base"];
    if (base !== undefined) {
        let pronunciation = getPronunciationElement(getPronunciations(base));
        let pos = getPOS(resource);
        if (pos != null) {
            if (!containsKey(baseMap, base)) {
                appendID('<tr><td><b>' + getLabel(base) + '</b>' + pronunciation + '</td>' +
                    '<td><ul class=\"entries\" id=\"row-' + currentRow + '\"></ul></td></tr>', "tbody");
                baseMap[base] = currentRow++;
            }
            extractPOS(baseObj, resource, pos);
        }
    }
}

function extractPOS(baseObj, res, pos) {
    let posName = getOntoName(pos);
    switch (posName) {
        case "Noun":
            extractNoun(baseObj, res);
            break;
        case "Adjective":
            extractAdjective(baseObj, res);
            break;
        case "Pronoun":
            extractPronoun(baseObj, res);
            break;
        case "Numeral":
            extractNumeral(baseObj, res);
            break;
        case "Verb":
            extractVerb(baseObj, res);
            break;
        case "Adverb":
            extractAdverb(baseObj, res);
            break;
        case "Preposition":
            extractPreposition(baseObj, res);
            break;
        case "Conjunction":
            extractConjunction(baseObj, res);
            break;
        case "Particle":
            extractParticle(baseObj, res);
            break;
        case "Interjection":
            extractInterjection(baseObj, res);
            break;
    }
}

// POS specific functions =============================================================================

function extractNoun(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        let query =
            PREFIXES +
            'SELECT ?gen ?an ' +
            'WHERE { ' +
            '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Noun . ' +
            '    optional {<' + res + '> lexinfo:gender  ?gen}' +
            '    optional {<' + res + '> lexinfo:animacy ?an}' +
            '    <' + base + '> dbnary:describes <' + res + '> .' +
            '}';
        let results = getResults(query);
        if (results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                let result = results[i];
                let gen = getValue(result, "gen");
                let an = getValue(result, "an");

                // for nouns that have more than one gender
                if (getOntoName(gen) === "feminine" || getOntoName(gen) === "neuter") {
                    an = "";
                }

                appendEntry(
                    base,
                    toCzech("noun") + ", " + toCzech(getOntoName(gen)) + " " + toCzech(getOntoName(an))
                );
            }
        }
    } else if (level === 2) {
        let query =
            PREFIXES +
            'SELECT ?c ?no ?gen ?an ' +
            'WHERE { ' +
            '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Noun ; ' +
            '                   lexinfo:case  ?c ; ' +
            '                   lexinfo:number  ?no ; ' +
            '                   lexinfo:gender  ?gen .' +
            '    optional {<' + res + '> lexinfo:animacy ?an}' +
            '    <' + base + '> dbnary:describes ?posRes . ' +
            '    ?posRes lemon:formVariant <' + res + '> . ' +
            '}';
        let results = getResults(query);
        if (results.length === 1) {
            let result = results[0];
            let c = getValue(result, "c");
            let no = getValue(result, "no");
            let gen = getValue(result, "gen");
            let an = getValue(result, "an");
            let genderStr = toCzech(getOntoName(gen));
            if (an !== "") {
                genderStr += " " + toCzech(getOntoName(an));
            }
            appendEntry(base, toCzech("noun") + ", " +
                genderStr + ", " +
                toCzech(getOntoName(no)) + ", " +
                toCzech(getOntoName(c)) + " pád");
        }
    }
}

function extractAdjective(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        appendEntry(base, toCzech("adjective"));
    } else if (level === 2) {
        if (isCaseForm(res)) {
            let query =
                PREFIXES +
                'SELECT ?c ?form ?no ?gen ?an ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech      lexinfo:adjective ; ' +
                '    optional {<' + res + '> lexinfo:case  ?c} ' +
                '    optional {<' + res + '> lexinfo:number  ?no} ' +
                '    optional {<' + res + '> lexinfo:gender  ?gen} ' +
                '    optional {<' + res + '> lexinfo:animacy ?an}' +
                '    optional {<' + res + '> mte:hasAdjectiveFormation ?form}' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let c = getValue(result, "c");
                let no = getValue(result, "no");

                let gen = getValue(result, "gen");
                let an = getValue(result, "an");

                let genderStr = toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }

                let form = getValue(result, "form");
                if (form !== "") {
                    form = "(" + toCzech(getOntoName(form)) + ")";
                }

                appendEntry(base, toCzech("adjective") + ", " +
                    toCzech(getOntoName(no)) + ", " +
                    genderStr + ", " +
                    toCzech(getOntoName(c)) + " pád " + form);
            }
        } else if (isDegreeForm(res)) {
            let query =
                PREFIXES +
                'SELECT ?deg ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech      lexinfo:adjective ; ' +
                '    optional {<' + res + '> lexinfo:degree ?deg}' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let deg = getValue(results[0], "deg");
                appendEntry(base, toCzech("adjective") + ", " + toCzech(getOntoName(deg)));
            }
        }
    }
}

function extractPronoun(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        let query =
            PREFIXES +
            'SELECT ?gen ?an ' +
            'WHERE { ' +
            '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Pronoun . ' +
            '    optional {<' + res + '> lexinfo:gender  ?gen}' +
            '    optional {<' + res + '> lexinfo:animacy ?an}' +
            '    <' + base + '> dbnary:describes <' + res + '> .' +
            '}';
        let results = getResults(query);
        if (results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                let result = results[i];
                let gen = getValue(result, "gen");
                let an = getValue(result, "an");
                let genderStr = "";
                if (gen !== "") {
                    genderStr += ", " + toCzech(getOntoName(gen));
                    if (an !== "") {
                        genderStr += " " + toCzech(getOntoName(an));
                    }
                }
                appendEntry(base, toCzech("pronoun") + genderStr);
            }
        }
    } else if (level === 2) {
        if ((isExtendedDeclension(res))) {
            let query =
                PREFIXES +
                'SELECT ?c ?no ?gen ?an ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech      lexinfo:Pronoun ; ' +
                '    optional {<' + res + '> lexinfo:case  ?c} ' +
                '    optional {<' + res + '> lexinfo:number  ?no} ' +
                '    optional {<' + res + '> lexinfo:gender  ?gen} ' +
                '    optional {<' + res + '> lexinfo:animacy ?an}' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let c = getValue(result, "c");
                let no = getValue(result, "no");

                let gen = getValue(result, "gen");
                let an = getValue(result, "an");

                let genderStr = toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }

                appendEntry(base, toCzech("pronoun") + ", " +
                    toCzech(getOntoName(no)) + ", " +
                    genderStr + ", " +
                    toCzech(getOntoName(c)) + " pád");
            }
        } else {
            let query =
                PREFIXES +
                'SELECT ?c ?no ' +
                'WHERE { ' +
                '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Pronoun ; ' +
                '                   lexinfo:case  ?c ; ' +
                '    optional {<' + res + '> lexinfo:number  ?no} ' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let no = getValue(result, "no");
                let noStr = "";
                if (no !== "") {
                    noStr = ", " + toCzech(getOntoName(no));
                }
                let c = getValue(result, "c");
                appendEntry(base, toCzech("pronoun") +
                    noStr + ", " +
                    toCzech(getOntoName(c)) + " pád");
            }
        }
    }
}

function extractNumeral(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        let query =
            PREFIXES +
            'SELECT ?no ?gen ?an ' +
            'WHERE { ' +
            '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Numeral . ' +
            '    optional {<' + res + '> lexinfo:gender  ?gen}' +
            '    optional {<' + res + '> lexinfo:animacy ?an}' +
            '    optional {<' + res + '> lexinfo:number ?no}' +
            '    <' + base + '> dbnary:describes <' + res + '> .' +
            '}';
        let results = getResults(query);
        if (results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                let result = results[i];
                let no = getValue(result, "no");
                let noStr = "";
                if (no !== "") {
                    noStr = ", " + toCzech(getOntoName(no));
                }
                let gen = getValue(result, "gen");
                let an = getValue(result, "an");
                let genderStr = ", " + toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }
                appendEntry(base, toCzech("numeral") + noStr + genderStr);
            }
        }
    } else if (level === 2) {
        if ((isExtendedDeclension(res))) {
            let query =
                PREFIXES +
                'SELECT ?c ?no ?gen ?an ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech      lexinfo:Numeral ; ' +
                '    optional {<' + res + '> lexinfo:case  ?c} ' +
                '    optional {<' + res + '> lexinfo:number  ?no} ' +
                '    optional {<' + res + '> lexinfo:gender  ?gen} ' +
                '    optional {<' + res + '> lexinfo:animacy ?an}' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let c = getValue(result, "c");
                let no = getValue(result, "no");

                let gen = getValue(result, "gen");
                let an = getValue(result, "an");

                let genderStr = toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }

                appendEntry(base, toCzech("numeral") + ", " +
                    toCzech(getOntoName(no)) + ", " +
                    genderStr + ", " +
                    toCzech(getOntoName(c)) + " pád");
            }
        } else {
            let query =
                PREFIXES +
                'SELECT ?c ?no ' +
                'WHERE { ' +
                '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Numeral ; ' +
                '                   lexinfo:case  ?c ; ' +
                '    optional {<' + res + '> lexinfo:number  ?no} ' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let no = getValue(result, "no");
                let noStr = "";
                if (no !== "") {
                    noStr = toCzech(getOntoName(no)) + ", ";
                }
                let c = getValue(result, "c");
                appendEntry(base, toCzech("numeral") + ", " +
                    noStr +
                    toCzech(getOntoName(c)) + " pád");
            }
        }
    }
}

function extractVerb(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        let query =
            PREFIXES +
            'SELECT ?mood ' +
            'WHERE { ' +
            '    <' + res + '>  lexinfo:partOfSpeech lexinfo:Verb . ' +
            '    optional {<' + res + '> lexinfo:VerbFormMood ?mood} ' +
            '    <' + base + '> dbnary:describes <' + res + '> .' +
            '}';
        let results = getResults(query);
        if (results.length === 1) {
            let mood = getValue(results[0], "mood");
            let moodStr = "";
            if (mood !== "") {
                moodStr = ", " + toCzech(getOntoName(mood))
            }
            appendEntry(base, toCzech("verb") + moodStr);
        }
    } else if (level === 2) {
        if (isVerbParticiple(res)) {
            let query =
                PREFIXES +
                'SELECT ?voice ?no ?gen ?an ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech  lexinfo:Verb ; ' +
                '                  lexinfo:voice         ?voice ;' +
                '                  lexinfo:number        ?no ;' +
                '                  lexinfo:gender        ?gen .' +
                '    optional {<' + res + '> lexinfo:animacy ?an }' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let voice = getValue(result, "voice");
                let no = getValue(result, "no");
                let gen = getValue(result, "gen");
                let an = getValue(result, "an");
                let genderStr = ", " + toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }

                appendEntry(base, toCzech("verb") + ", " +
                    toCzech(getOntoName(voice)) + ", " +
                    toCzech(getOntoName(no)) +
                    genderStr);
            }
        } else if (isVerbTransgressive(res)) {
            let query =
                PREFIXES +
                'SELECT ?tense ?no ?gen ?an ' +
                'WHERE { ' +
                '    <' + res + '>  lexinfo:partOfSpeech        lexinfo:Verb ; ' +
                '                   mte:hasVerbForm             mte:Transgressive ;' +
                '                   lexinfo:tense               ?tense ;' +
                '                   lexinfo:number              ?no ;' +
                '                   lexinfo:gender              ?gen .' +
                '    optional {<' + res + '> lexinfo:animacy ?an }' +
                '    <' + base + '> dbnary:describes            ?posRes . ' +
                '    ?posRes        lemon:formVariant           <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let tense = getValue(result, "tense");
                let no = getValue(result, "no");
                let gen = getValue(result, "gen");
                let an = getValue(result, "an");
                let genderStr = ", " + toCzech(getOntoName(gen));
                if (an !== "") {
                    genderStr += " " + toCzech(getOntoName(an));
                }

                appendEntry(base, toCzech("verb") + ", " +
                    toCzech("Transgressive") + ", " +
                    toCzech(getOntoName(tense)) + ", " +
                    toCzech(getOntoName(no)) +
                    genderStr);
            }
        } else if (isVerbConditional(res)) {
            let query =
                PREFIXES +
                'SELECT ?no ?person ' +
                'WHERE { ' +
                '    <' + res + '>  lexinfo:partOfSpeech  lexinfo:Verb ; ' +
                '                   lexinfo:VerbFormMood  lexinfo:conditional ;' +
                '                   lexinfo:number        ?no ;' +
                '                   lexinfo:person        ?person .' +
                '    <' + base + '> dbnary:describes      ?posRes . ' +
                '    ?posRes        lemon:formVariant     <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let no = getValue(result, "no");
                let person = getValue(result, "person");

                appendEntry(base, toCzech("verb") + ", " +
                    toCzech("conditional") + ", " +
                    toCzech(getOntoName(no)) + ", " +
                    toCzech(getOntoName(person)));
            }
        } else if (isVerbMood(res)) {
            let query =
                PREFIXES +
                'SELECT ?mood ?tense ?no ?person ' +
                'WHERE { ' +
                '    <' + res + '> lexinfo:partOfSpeech  lexinfo:Verb ; ' +
                '                  lexinfo:VerbFormMood  ?mood ;' +
                '                  lexinfo:number        ?no ;' +
                '                  lexinfo:person        ?person .' +
                '    optional {<' + res + '> lexinfo:tense ?tense}' +
                '    <' + base + '> dbnary:describes ?posRes . ' +
                '    ?posRes lemon:formVariant <' + res + '> . ' +
                '}';
            let results = getResults(query);
            if (results.length === 1) {
                let result = results[0];
                let mood = getValue(result, "mood");
                let tense = getValue(result, "tense");
                let no = getValue(result, "no");
                let person = getValue(result, "person");

                appendEntry(base, toCzech("verb") + ", " +
                    toCzech(getOntoName(mood)) + ", " +
                    toCzech(getOntoName(tense)) + ", " +
                    toCzech(getOntoName(no)) + ", " +
                    toCzech(getOntoName(person)));
            }
        }
    }
}

function extractAdverb(baseObj, res) {
    let level = baseObj["level"];
    let base = baseObj["base"];
    if (level === 1) {
        appendEntry(base, toCzech("adverb"));
    } else if (level === 2) {
        let query =
            PREFIXES +
            'SELECT ?deg ' +
            'WHERE { ' +
            '    <' + res + '> lexinfo:partOfSpeech      lexinfo:Adverb ; ' +
            '    optional {<' + res + '> lexinfo:degree ?deg}' +
            '    <' + base + '> dbnary:describes ?posRes . ' +
            '    ?posRes lemon:formVariant <' + res + '> . ' +
            '}';
        let results = getResults(query);
        if (results.length === 1) {
            let deg = getValue(results[0], "deg");
            appendEntry(base, toCzech("adverb") + ", " + toCzech(getOntoName(deg)));
        }
    }
}

function extractPreposition(baseObj, res) {
    let base = baseObj["base"];
    appendEntry(base, toCzech("preposition"));
}

function extractConjunction(baseObj, res) {
    let base = baseObj["base"];
    appendEntry(base, toCzech("conjunction"));
}

function extractParticle(baseObj, res) {
    let base = baseObj["base"];
    appendEntry(base, toCzech("particle"));
}

function extractInterjection(baseObj, res) {
    let base = baseObj["base"];
    appendEntry(base, toCzech("interjection"));
}

function isVerbMood(res) {
    let query =
        PREFIXES +
        'SELECT ?mood ' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:VerbFormMood ?mood .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function isVerbParticiple(res) {
    let query =
        PREFIXES +
        'SELECT ?voice ' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:voice ?voice .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function isVerbTransgressive(res) {
    let query =
        PREFIXES +
        'SELECT * ' +
        'WHERE { ' +
        '    <' + res + '> mte:hasVerbForm mte:Transgressive .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function isVerbConditional(res) {
    let query =
        PREFIXES +
        'SELECT * ' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:VerbFormMood lexinfo:conditional .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

// common functions ===================================================================================

function isCaseForm(res) {
    let query =
        PREFIXES +
        'SELECT ?c' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:case ?c .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function isDegreeForm(res) {
    let query =
        PREFIXES +
        'SELECT ?deg' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:degree ?deg .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function isExtendedDeclension(res) {
    let query =
        PREFIXES +
        'SELECT ?gen' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:gender ?gen .' +
        '}';
    let results = getResults(query);
    return (results.length === 1);
}

function getPOS(res) {
    let posQuery =
        PREFIXES +
        'SELECT  ?pos ' +
        'WHERE { ' +
        '    <' + res + '> lexinfo:partOfSpeech ?pos . ' +
        '}';
    let results = getResults(posQuery);
    if (results.length > 0) {
        return getValue(results[0], "pos");
    }
    return null;
}

function getPronunciations(base) {
    let pronQuery =
        PREFIXES +
        'SELECT  ?pron ' +
        'WHERE { ' +
        '    <' + base + '> lexinfo:pronunciation ?pron . ' +
        '}';
    let results = getResults(pronQuery);
    let pronunciations = [];
    if (results.length > 0) {
        for (let i = 0; i < results.length; i++) {
            pronunciations.push(results[i]["pron"]["value"]);
        }
    }
    return pronunciations;
}

function getBase(res) {
    let baseQuery =
        PREFIXES +
        'SELECT ?base1 ?base2 ' +
        'WHERE { ' +
        '    optional {' +
        '        ?base1 dbnary:describes <' + res + '>' +
        '    } ' +
        '    optional { ' +
        '        ?posRes    lemon:formVariant <' + res + '>.' +
        '        ?base2      dbnary:describes      ?posRes . ' +
        '    }' +
        '}';
    let results = getResults(baseQuery);
    let level, base;
    if (results.length === 1) {
        let result = results[0];
        if (containsKey(result, "base1")) {
            level = 1;
            base = getValue(result, "base1");
        } else {
            level = 2;
            base = getValue(result, "base2");
        }
    }
    return {"level": level, "base": base};
}

function getLabel(res) {
    let query =
        PREFIXES +
        'SELECT ?lab ' +
        'WHERE { ' +
        '    <' + res + '> rdfs:label ?lab. ' +
        '}';
    let results = getResults(query);
    return getValue(results[0], "lab");
}

// minor functions =====================================================================================

function getResourceName(resource) {
    return resource.substring(resource.lastIndexOf("/") + 1);
}

function getValue(result, key) {
    return (containsKey(result, key))
        ? result[key]["value"]
        : "";
}

function getOntoName(property) {
    return property.substring(property.lastIndexOf("#") + 1);
}

function getPronunciationElement(pronunciations) {
    let pronElement = "";
    if (pronunciations.length > 0) {
        pronElement = " (<i>" + pronunciations.join(" / ") + "</i>)";
    }
    return pronElement;
}

function appendEntry(base, entry) {
    appendID('<li class=\"entry\">' + entry + '</li>', "row-" + baseMap[base]);
}

function appendID(element, id) {
    document.getElementById(id).innerHTML += element;
}

function containsKey(object, key) {
    let keyVal = object[key];
    return (keyVal !== undefined);
}

function getCaseOrder(caseName) {
    let no;
    switch (caseName) {
        case "nominativeCase":
            no = 1;
            break;
        case "genitiveCase":
            no = 2;
            break;
        case "dativeCase":
            no = 3;
            break;
        case "accusativeCase":
            no = 4;
            break;
        case "vocativeCase":
            no = 5;
            break;
        case "locativeCase":
            no = 6;
            break;
        case "instrumentalCase":
            no = 7;
            break;
        default:
            no = -1;
            break;
    }
    let caseStr;
    switch (no) {
        case 1:
            caseStr = "" + no + "st";
            break;
        case 2:
            caseStr = "" + no + "nd";
            break;
        case 3:
            caseStr = "" + no + "rd";
            break;
        case -1:
            caseStr = "";
            break;
        default:
            caseStr = "" + no + "th";
            break;
    }
    return caseStr;
}

function toCzech(word) {
    switch (word) {
        case "masculine" :
            return "rod mužský";
        case "feminine" :
            return "rod ženský";
        case "neuter" :
            return "rod střední";
        case "animate" :
            return "životný";
        case "inanimate" :
            return "neživotný";
        case "singular" :
            return "č. jednotné";
        case "plural" :
            return "č. množné";
        case "dual" :
            return "č. duální";
        case "nominativeCase" :
            return "1.";
        case "genitiveCase" :
            return "2.";
        case "dativeCase" :
            return "3.";
        case "accusativeCase" :
            return "4.";
        case "vocativeCase" :
            return "5.";
        case "locativeCase" :
            return "6.";
        case "instrumentalCase" :
            return "7.";
        case "noun" :
            return "podstatné jméno";
        case "adjective" :
            return "přídavné jméno";
        case "pronoun" :
            return "zájmeno";
        case "numeral" :
            return "číslovka";
        case "verb" :
            return "sloveso";
        case "adverb" :
            return "příslovce";
        case "preposition" :
            return "předložka";
        case "conjunction" :
            return "spojka";
        case "particle" :
            return "částice";
        case "interjection":
            return "citoslovce";
        case "NominalAdjective" :
            return "jmenný tvar";
        case "positive":
            return "1. stupeň";
        case "comparative" :
            return "2. stupeň";
        case "superlative" :
            return "3. stupeň";
        case "firstPerson" :
            return "1. os.";
        case "secondPerson" :
            return "2. os.";
        case "thirdPerson" :
            return "3. os.";
        case  "indicative" :
            return "zp. oznamovací";
        case  "imperative" :
            return "zp. rozkazovací";
        case  "infinitive" :
            return "infinitiv";
        case  "active" :
            return "rod činný";
        case  "passive" :
            return "rod trpný";
        case  "past" :
            return "čas minulý";
        case  "present" :
            return "čas přítomný";
        case  "future" :
            return "čas budoucí";
        case "Transgressive":
            return "přechodník";
        case "conditional":
            return "zp. podmiňovací";
        default:
            return word;
    }
}

let PREFIXES =
    "PREFIX ex: <http://www.example.com/> " +
    "PREFIX cs-dbpedia: <http://cs.dbpedia.org/resource/> " +
    "PREFIX lemon: <http://lemon-model.net/lemon#> " +
    "PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> " +
    "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> " +
    "PREFIX dbnary: <http://kaiko.getalp.org/dbnary#> " +
    "PREFIX mte: <http://nl.ijs.si/ME/owl/multext-east.owl#> ";