function sendRequest() {
    document.getElementById("output").innerHTML = ""; // resetting output
    let title = document.getElementById("title");
    title.innerHTML = "<b>Výsledky dotazu:</b>";

    let query = document.getElementById("query").value;

    // Store last query
    localStorage.lastquery = query;

    document.getElementById("output").innerHTML = getResults(query.trim());
    console.log("Query FINISHED");
}

function getResults(query) {
    let endpoint = "http://localhost:3030/wiki/sparql";
    let params = "?query=" + encodeURIComponent(PREFIXES.replace("\n", "") + query) + "&output=text";

    let result = "";

    let http = new XMLHttpRequest();
    http.open("GET", endpoint + params, false);
    http.onreadystatechange = function () {
        if (http.readyState === 4) {
            result = http.responseText;
        }
    };
    http.send();
    return result;
}

let PREFIXES = "PREFIX ex: <http://www.example.com/> \n" +
    "PREFIX lemon: <http://lemon-model.net/lemon#> \n" +
    "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n" +
    "PREFIX wiki: <http://cs.wiktionary.org/wiki/> \n" +
    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \n" +
    "PREFIX lexinfo: <http://www.lexinfo.net/ontology/2.0/lexinfo#> \n" +
    "PREFIX dbnary: <http://kaiko.getalp.org/dbnary#> \n" +
    "PREFIX mte: <http://nl.ijs.si/ME/owl/multext-east.owl#> \n";