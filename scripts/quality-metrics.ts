import * as fs from 'fs';
import * as yaml from 'js-yaml';

// 型定義
export interface QualityMetric {
  name: string;
  score: number;      // 0-100
  weight: number;     // 重み
  details: string;    // 詳細説明
  suggestions: string[]; // 改善提案
}

export interface ArticleQuality {
  file: string;
  title: string;
  totalScore: number;  // 0-100（加重平均）
  grade: 'S' | 'A' | 'B' | 'C' | 'D'; // S:90+ A:80+ B:70+ C:50+ D:<50
  metrics: QualityMetric[];
}

// frontmatterとbodyを分離
export function parseFrontmatter(content: string): { frontmatter: any; body: string } {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');

  try {
    const frontmatter = yaml.load(frontmatterLines);
    return { frontmatter, body };
  } catch (e) {
    return { frontmatter: {}, body: content };
  }
}

// メトリクス計算関数

// 1. frontmatter完全性 (weight: 15)
export function calculateFrontmatterCompleteness(frontmatter: any): QualityMetric {
  const suggestions: string[] = [];
  let score = 0;

  // 必須フィールド（各+2点、計12点）
  const requiredFields = ['title', 'appId', 'genres', 'price', 'releaseDate', 'developer'];
  requiredFields.forEach(field => {
    if (frontmatter[field]) {
      score += 2;
    } else {
      suggestions.push(`${field} フィールドが不足しています`);
    }
  });

  // reviewPercentage > 0: +1点
  if (frontmatter.reviewPercentage && frontmatter.reviewPercentage > 0) {
    score += 1;
  } else {
    suggestions.push('reviewPercentage が設定されていません');
  }

  // headerImage: URL形式で+1点
  if (frontmatter.headerImage && frontmatter.headerImage.startsWith('http')) {
    score += 1;
  } else {
    suggestions.push('headerImage が有効なURLではありません');
  }

  // kansaiCatch: 存在で+1、20-40文字なら追加+1
  if (frontmatter.kansaiCatch) {
    score += 1;
    const length = frontmatter.kansaiCatch.length;
    if (length >= 20 && length <= 40) {
      score += 1;
    } else {
      suggestions.push(`kansaiCatch の文字数が推奨範囲外です（現在${length}文字、推奨20-40文字）`);
    }
  } else {
    suggestions.push('kansaiCatch フィールドが不足しています');
  }

  // スコアを0-100に正規化（満点16点）
  const normalizedScore = Math.round((score / 16) * 100);

  return {
    name: 'frontmatter完全性',
    score: normalizedScore,
    weight: 15,
    details: `必須フィールド: ${score}/16点`,
    suggestions,
  };
}

// 2. コンテンツ量 (weight: 25)
export function calculateContentVolume(body: string): QualityMetric {
  const charCount = body.length;
  const suggestions: string[] = [];
  let score = 0;

  if (charCount < 500) {
    score = 0;
    suggestions.push(`文字数が不足しています（${charCount}文字 < 500文字）`);
  } else if (charCount < 1000) {
    score = 40;
    suggestions.push('コンテンツ量が少なめです。1000文字以上を目指しましょう');
  } else if (charCount < 2000) {
    score = 70;
  } else if (charCount < 3000) {
    score = 90;
  } else {
    score = 100;
  }

  return {
    name: 'コンテンツ量',
    score,
    weight: 25,
    details: `${charCount}文字`,
    suggestions,
  };
}

// 3. セクション構造 (weight: 20)
export function calculateSectionStructure(body: string): QualityMetric {
  const suggestions: string[] = [];
  let score = 0;

  // 「## このゲームの魅力」or「## 公式説明」: +30
  if (body.includes('## このゲームの魅力') || body.includes('## 公式説明')) {
    score += 30;
  } else {
    suggestions.push('「## このゲームの魅力」または「## 公式説明」セクションが不足しています');
  }

  // 「## ユーザーレビュー」: +30
  if (body.includes('## ユーザーレビュー')) {
    score += 30;
  } else {
    suggestions.push('「## ユーザーレビュー」セクションが不足しています');
  }

  // 「## ここがおもろい！」or 関西弁解説セクション: +30
  if (body.includes('## ここがおもろい') || body.includes('やで') || body.includes('やな')) {
    score += 30;
  } else {
    suggestions.push('関西弁解説セクション（「## ここがおもろい！」等）が不足しています');
  }

  // テーブル（|）: +10
  if (body.includes('| 項目 | 詳細 |') || (body.includes('|') && body.includes('---'))) {
    score += 10;
  } else {
    suggestions.push('項目/詳細テーブルが不足しています');
  }

  return {
    name: 'セクション構造',
    score,
    weight: 20,
    details: `${score}/100点`,
    suggestions,
  };
}

// 4. レビュー充実度 (weight: 15)
export function calculateReviewRichness(body: string): QualityMetric {
  const suggestions: string[] = [];
  const blockquoteCount = (body.match(/^>/gm) || []).length;
  let score = 0;

  if (blockquoteCount === 0) {
    score = 0;
    suggestions.push('ユーザーレビュー（blockquote）が1つもありません');
  } else if (blockquoteCount === 1) {
    score = 40;
    suggestions.push('レビューが1件のみです。2件以上あると充実します');
  } else if (blockquoteCount === 2) {
    score = 70;
  } else {
    score = 100;
  }

  return {
    name: 'レビュー充実度',
    score,
    weight: 15,
    details: `${blockquoteCount}件のレビュー`,
    suggestions,
  };
}

// 5. 関西弁密度 (weight: 10)
export function calculateKansaiDialectDensity(body: string): QualityMetric {
  const suggestions: string[] = [];
  const markers = [
    'やで', 'やん', 'やんか', 'やな', 'やわ', 'やろ', 'やねん',
    'めっちゃ', 'ほんま', 'おもろ', 'あかん', 'ちゃう', 'やっぱ',
    'してん', 'やけど', 'やし'
  ];

  let markerCount = 0;
  markers.forEach(marker => {
    const regex = new RegExp(marker, 'g');
    const matches = body.match(regex);
    if (matches) {
      markerCount += matches.length;
    }
  });

  const density = (markerCount / body.length) * 10000;
  let score = 0;

  if (density === 0) {
    score = 0;
    suggestions.push('関西弁マーカーが見つかりません。関西弁で解説を追加してください');
  } else if (density < 5) {
    score = 40;
    suggestions.push('関西弁の頻度が少なめです。もっと関西弁を使ってみてください');
  } else if (density < 15) {
    score = 70;
  } else {
    score = 100;
  }

  return {
    name: '関西弁密度',
    score,
    weight: 10,
    details: `${markerCount}個のマーカー（密度: ${density.toFixed(2)}）`,
    suggestions,
  };
}

// 6. リンク・メディア (weight: 10)
export function calculateLinkMedia(frontmatter: any, body: string): QualityMetric {
  const suggestions: string[] = [];
  let score = 0;

  // Steamストアリンク: +40
  if (body.includes('store.steampowered.com')) {
    score += 40;
  } else {
    suggestions.push('Steamストアリンクが不足しています');
  }

  // headerImage有効URL: +30
  if (frontmatter.headerImage && frontmatter.headerImage.startsWith('http')) {
    score += 30;
  } else {
    suggestions.push('headerImage が有効なURLではありません');
  }

  // 本文中に画像（![）: +30
  if (body.includes('![')) {
    score += 30;
  } else {
    suggestions.push('本文中に画像がありません');
  }

  return {
    name: 'リンク・メディア',
    score,
    weight: 10,
    details: `${score}/100点`,
    suggestions,
  };
}

// 7. 鮮度 (weight: 5)
export function calculateFreshness(frontmatter: any): QualityMetric {
  const suggestions: string[] = [];
  let score = 20;

  if (!frontmatter.generatedAt) {
    suggestions.push('generatedAt フィールドが不足しています');
    return {
      name: '鮮度',
      score,
      weight: 5,
      details: '生成日不明',
      suggestions,
    };
  }

  const generatedDate = new Date(frontmatter.generatedAt);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - generatedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 7) {
    score = 100;
  } else if (daysDiff <= 30) {
    score = 80;
  } else if (daysDiff <= 90) {
    score = 50;
    suggestions.push('記事の生成日が30日以上前です。再生成を検討してください');
  } else {
    score = 20;
    suggestions.push('記事の生成日が90日以上前です。早急に再生成してください');
  }

  return {
    name: '鮮度',
    score,
    weight: 5,
    details: `${daysDiff}日前`,
    suggestions,
  };
}

// 総合評価
export function evaluateArticle(filePath: string): ArticleQuality {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const metrics: QualityMetric[] = [
    calculateFrontmatterCompleteness(frontmatter),
    calculateContentVolume(body),
    calculateSectionStructure(body),
    calculateReviewRichness(body),
    calculateKansaiDialectDensity(body),
    calculateLinkMedia(frontmatter, body),
    calculateFreshness(frontmatter),
  ];

  // 加重平均で総合スコアを計算
  let totalWeightedScore = 0;
  let totalWeight = 0;
  metrics.forEach(metric => {
    totalWeightedScore += metric.score * metric.weight;
    totalWeight += metric.weight;
  });
  const totalScore = Math.round(totalWeightedScore / totalWeight);

  // グレード判定
  let grade: 'S' | 'A' | 'B' | 'C' | 'D';
  if (totalScore >= 90) {
    grade = 'S';
  } else if (totalScore >= 80) {
    grade = 'A';
  } else if (totalScore >= 70) {
    grade = 'B';
  } else if (totalScore >= 50) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  return {
    file: filePath,
    title: frontmatter.title || 'タイトル不明',
    totalScore,
    grade,
    metrics,
  };
}
