export { SuffixTree }

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