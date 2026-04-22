// Generated from Leo tree-sitter syntax data. Do not edit by hand.
// Source repo: ProvableHQ/leo
// Source ref: v4.0.1
// Resolved commit: abe1e1e8e5dd48ae5a849a94c802175419bebb30

Prism.languages.leo = {
  "comment": [
    {
      "pattern": new RegExp("(^|[^\\\\:])\\/\\/[^\\n]*"),
      "lookbehind": true,
      "greedy": true
    },
    {
      "pattern": new RegExp("(^|[^\\\\])/\\*[^*]*\\*+([^/*][^*]*\\*+)*/"),
      "lookbehind": true,
      "greedy": true
    }
  ],
  "annotation": {
    "pattern": new RegExp("@(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)"),
    "alias": "annotation"
  },
  "string": [
    {
      "pattern": new RegExp("\"[^\"]*\""),
      "greedy": true
    }
  ],
  "address": {
    "pattern": new RegExp("aleo1[a-z0-9]+"),
    "alias": "string"
  },
  "number": {
    "pattern": new RegExp("(^|[^A-Za-z0-9_])(?:(?:[0-9][0-9A-Za-z_]*(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)?|0b[0-9A-Za-z_]+(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)?|0o[0-9A-Za-z_]+(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)?|0x[0-9A-Za-z_]+(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)?|[0-9][0-9_]*scalar|[0-9][0-9_]*field|[0-9][0-9_]*group))(?![A-Za-z0-9_])"),
    "lookbehind": true
  },
  "program-id": {
    "pattern": new RegExp("\\b(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)\\.aleo\\b"),
    "alias": "file",
    "inside": {
      "punctuation": new RegExp("\\."),
      "keyword": new RegExp("\\baleo\\b")
    }
  },
  "visibility": new RegExp("\\b(?:constant|private|public)\\b"),
  "type-name": [
    {
      "pattern": new RegExp("\\bstruct\\s+(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)\\b"),
      "inside": {
        "keyword": new RegExp("\\bstruct\\b"),
        "type-name": {
          "pattern": new RegExp("[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*"),
          "alias": "class-name"
        }
      }
    },
    {
      "pattern": new RegExp("\\brecord\\s+(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)\\b"),
      "inside": {
        "keyword": new RegExp("\\brecord\\b"),
        "type-name": {
          "pattern": new RegExp("[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*"),
          "alias": "class-name"
        }
      }
    },
    {
      "pattern": new RegExp("\\binterface\\s+(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)\\b"),
      "inside": {
        "keyword": new RegExp("\\binterface\\b"),
        "type-name": {
          "pattern": new RegExp("[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*"),
          "alias": "class-name"
        }
      }
    }
  ],
  "keyword": new RegExp("\\b(?:assert_neq|assert_eq|interface|mapping|network|program|storage|assert|import|record|return|struct|block|const|final|Final|aleo|else|self|for|let|as|fn|Fn|if|in)\\b"),
  "type-keyword": new RegExp("\\b(?:signature|address|scalar|string|field|group|bool|i128|u128|i16|i32|i64|u16|u32|u64|i8|u8)\\b"),
  "bool-keyword": new RegExp("\\b(?:false|true)\\b"),
  "builtin-constant": [
    {
      "pattern": new RegExp("\\b(?:none)\\b"),
      "alias": "constant"
    },
    {
      "pattern": new RegExp("(?:signature::[a-zA-Z][a-zA-Z0-9_]*|Future::[a-zA-Z][a-zA-Z0-9_]*|group::[a-zA-Z][a-zA-Z0-9_]*)"),
      "alias": "constant"
    }
  ],
  "function": [
    {
      "pattern": new RegExp("\\bconstructor\\b"),
      "alias": "function"
    },
    new RegExp("(?:[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z][a-zA-Z0-9_]*)(?=\\s*(?:\\(|::\\[))")
  ],
  "operator": new RegExp("(?:\\b(?:as)\\b|\\.\\.=|\\*\\*=|&&=|<<=|>>=|\\|\\|=|\\-=|!=|\\.\\.|\\*\\*|\\*=|/=|&&|&=|%=|\\^=|\\+=|<<|<=|==|>=|>>|\\|=|\\|\\||\\-|!|\\?|\\*|/|&|%|\\^|\\+|<|=|>|\\|)"),
  "punctuation": new RegExp("(?:\\->|::|=>|,|;|:|\\.|\\(|\\)|\\[|\\]|\\{|\\}|@)")
};
