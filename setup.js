// setup.js
module.exports = function (Handlebars) {
  Handlebars.registerHelper('custom', function (context, options) {
    const {exclude, message, subject, id, href} = context.hash;
    const excludeRegex = new RegExp(exclude);
    const messageRegex = new RegExp(message);

    const matchExclude = exclude && excludeRegex.test(subject);
    const matchMessage = message && messageRegex.test(subject);

    if (matchExclude || !matchMessage) {
      return;
    }

    return `- ${subject} [${id}](${href})`;
  });
};
