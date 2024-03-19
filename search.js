export { SuffixTree, all_words_in_name }

class suffixTreeNode {
    constructor() {
        this.children = {};
        this.results = new Set();
    }
}

class SuffixTree {
    constructor(case_sensitive = false) {
        this.root = new suffixTreeNode();
        this.case_sensitive = case_sensitive;
    }

    add(key, result) {
        for (let i = 0; i < key.length; i++) {
            this.insertSuffix(key.substring(i), result, i);
        }
    }

    insertSuffix(suffix, result, index) {
        if (!this.case_sensitive)
            suffix = suffix.toLowerCase();
        let node = this.root;
        for (let i = 0; i < suffix.length; i++) {
            let char = suffix[i];
            if (!node.children[char]) {
                node.children[char] = new suffixTreeNode();
            }
            node = node.children[char];
            node.results.add(result); 
        }
    }

    search_pattern(pattern) {
        if (!this.case_sensitive)
            pattern = pattern.toLowerCase();
        let node = this.root;
        for (let i = 0; i < pattern.length; i++) {
            let char = pattern[i];
            if (!node.children[char]) {
                return new Set();  // no results
            }
            node = node.children[char];
        }
        return node.results;
    }

    search_all_words(string) {
        /* return the set intersection of a pattern search for each word in string */
        let words = string.split(' ');
        let results = null;
        for (let i in words) {
            let word = words[i];
            if (i == 0) {
                results = this.search_pattern(word);
            }
            else if (word.trim().length > 0) {
                results = intersection(results, this.search_pattern(word));
            }
        }
        return Array.from(results);
    }
}

function all_words_in_name(string, name) {
    /* return true if all words of string are in name
    use this when you don't need the data structure,
    e.g. if you are loading names one by one */
    let words = string.split(' ');
    for (let i in words) {
        let word = words[i];
        if (!name.includes(word)) {
            return false;
        }
    }
    return true;
}

function intersection(set1, set2) {
    return new Set([...set1].filter(x => set2.has(x)));
}

function test() {
    T = new SuffixTree();
    T.add('banana', new SearchResult('banana', '-> banana link'));
    T.add('fruit', new SearchResult('banana', '-> banana link'));
    T.add('tomato', new SearchResult('tomato', '-> tomato link'));
    T.add('fruit', new SearchResult('tomato', '-> tomato link'));

    console.log(T.search_pattern('na'));
    console.log(T.search_pattern('yjdgfjgf'));
    console.log(T.search_pattern('fruit'));
    console.log(T.search_all_words('to ma'));
    console.log(T.search_all_words('to ma ba'));
}
//test()