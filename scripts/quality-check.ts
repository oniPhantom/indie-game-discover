import * as fs from 'fs';
import * as path from 'path';
import { evaluateArticle, ArticleQuality } from './quality-metrics.js';

// 罫線文字
const BOX = {
  TOP_LEFT: '╔',
  TOP_RIGHT: '╗',
  BOTTOM_LEFT: '╚',
  BOTTOM_RIGHT: '╝',
  HORIZONTAL: '═',
  VERTICAL: '║',
  SEPARATOR: '╠',
  SEPARATOR_RIGHT: '╣',
};

// ヘッダーを描画
function printHeader(text: string) {
  const width = 50;
  const padding = width - text.length - 2;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  console.log(BOX.TOP_LEFT + BOX.HORIZONTAL.repeat(width) + BOX.TOP_RIGHT);
  console.log(BOX.VERTICAL + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + BOX.VERTICAL);
  console.log(BOX.SEPARATOR + BOX.HORIZONTAL.repeat(width) + BOX.SEPARATOR_RIGHT);
  console.log('');
}

// フッターを描画
function printFooter() {
  console.log(BOX.BOTTOM_LEFT + BOX.HORIZONTAL.repeat(50) + BOX.BOTTOM_RIGHT);
  console.log('');
}

// グレードの色付け（エミュレート）
function formatGrade(grade: string): string {
  const gradeMap: { [key: string]: string } = {
    S: '🌟 S',
    A: '✨ A',
    B: '👍 B',
    C: '⚠️  C',
    D: '❌ D',
  };
  return gradeMap[grade] || grade;
}

// 記事の詳細を表示
function printArticleDetail(article: ArticleQuality) {
  console.log(`📄 ${article.title}`);
  console.log('━'.repeat(50));
  console.log(`総合スコア: ${article.totalScore}/100 [${formatGrade(article.grade)}]`);
  console.log('┌─────────────────────────┬───────┐');

  article.metrics.forEach(metric => {
    const namePadded = metric.name.padEnd(20, ' ');
    const scorePadded = `${metric.score}/100`.padStart(6, ' ');
    console.log(`│ ${namePadded}│${scorePadded}│`);
  });

  console.log('└─────────────────────────┴───────┘');

  // 改善提案を表示
  const allSuggestions = article.metrics.flatMap(m => m.suggestions);
  if (allSuggestions.length > 0) {
    console.log('💡 改善提案:');
    allSuggestions.forEach(suggestion => {
      console.log(`  - ${suggestion}`);
    });
  }

  console.log('');
}

// サマリーを表示
function printSummary(articles: ArticleQuality[]) {
  const totalArticles = articles.length;
  const avgScore = Math.round(
    articles.reduce((sum, a) => sum + a.totalScore, 0) / totalArticles
  );

  const gradeCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  articles.forEach(article => {
    gradeCounts[article.grade]++;
  });

  const needsImprovement = articles.filter(a => a.totalScore < 70).length;

  console.log(BOX.TOP_LEFT + BOX.HORIZONTAL.repeat(50) + BOX.TOP_RIGHT);
  console.log(BOX.VERTICAL + ' サマリー'.padEnd(50, ' ') + BOX.VERTICAL);
  console.log(BOX.SEPARATOR + BOX.HORIZONTAL.repeat(50) + BOX.SEPARATOR_RIGHT);
  console.log(BOX.VERTICAL + ` 記事数: ${totalArticles}`.padEnd(50, ' ') + BOX.VERTICAL);
  console.log(BOX.VERTICAL + ` 平均スコア: ${avgScore}/100`.padEnd(50, ' ') + BOX.VERTICAL);
  console.log(
    BOX.VERTICAL +
      ` グレード分布: S:${gradeCounts.S} A:${gradeCounts.A} B:${gradeCounts.B} C:${gradeCounts.C} D:${gradeCounts.D}`.padEnd(
        50,
        ' '
      ) +
      BOX.VERTICAL
  );
  console.log(
    BOX.VERTICAL + ` 改善が必要な記事: ${needsImprovement}件`.padEnd(50, ' ') + BOX.VERTICAL
  );
  console.log(BOX.BOTTOM_LEFT + BOX.HORIZONTAL.repeat(50) + BOX.BOTTOM_RIGHT);
}

// メイン処理
function main() {
  const gamesDir = path.join(process.cwd(), 'src/content/games');
  const files = fs.readdirSync(gamesDir).filter(file => file.endsWith('.md'));

  if (files.length === 0) {
    console.log('記事が見つかりませんでした。');
    return;
  }

  printHeader('📊 記事品質レポート');

  const articles: ArticleQuality[] = [];
  files.forEach(file => {
    const filePath = path.join(gamesDir, file);
    const article = evaluateArticle(filePath);
    articles.push(article);
    printArticleDetail(article);
  });

  printSummary(articles);
}

main();
