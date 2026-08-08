const fs = require('fs');
const file = 'c:/Users/Ocean/OneDrive/Desktop/BugsFix/comedyApp/client/src/_components/PostCard/PostCard.styles.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
    borderColor: COLORS.border,
  },
  currentEmoji: {
    fontSize: 14,
    marginRight: 3,
  },
  starTrigger: {
    marginRight: 3,
  },
  reactionTotal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  iconRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  captionWrap: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0.14,
    textAlign: 'left',
    color: COLORS.textPrimary,
  },
  captionMore: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  hashtags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  hashtag: {
    paddingVertical: 2,
  },
  hashtagText: {
    color: '#667eea',
`;

// Looking for the exact spot where the code was truncated.
// Lines currently end with:
//     borderRadius: 20,
//     marginRight: 10,
//     borderWidth: 1,
//     fontSize: 12,
//     fontWeight: '600',
//   },
content = content.replace(
  /    borderWidth: 1,[\r\n]+    fontSize: 12,[\r\n]+    fontWeight: '600',[\r\n]+  },/,
  "    borderWidth: 1," + replacement + "    fontSize: 12,\n    fontWeight: '600',\n  },"
);

fs.writeFileSync(file, content);
console.log('Fixed');
