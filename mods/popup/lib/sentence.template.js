module.exports = (lesson, sentence) => {
	let s = sentence.sentence_text.replaceAll('\\', '');

	return `
    <tr class="sentence">
      <td class="sentence-player"></td>
      <td class="sentence-speaker"></td>
      <td class="sentence-data">
	<div class="lesson_sentence_source" id="lesson_sentence_source_${sentence.id}">${s}</div>
	<div class="lesson_sentence_pinyin" id="lesson_sentence_pinyin_${sentence.id}">${s}</div>
	<div class="lesson_sentence_translation" id="lesson_sentence_translation_${sentence.id}">${sentence.sentence_translation}</div>
      </td>
    </tr>
  `;
};
