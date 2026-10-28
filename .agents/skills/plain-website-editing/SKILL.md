---
name: plain-website-editing
description: Build or revise website copy and interfaces with concise, source-faithful text and useful controls. Use for website authoring or editorial cleanup, including Glycoprotein Atlas work; do not use to rewrite unrelated manuscripts.
---

# Plain website editing

Make the requested change with the least extra text and interface needed.
For `glycoproteinatlas.org` or `twclab/glycoprotein_atlas`, read
[the atlas reference](references/glycoprotein-atlas.md).

## Content comes first

Use supplied prose and figures as the baseline. Keep author wording unless the
user requests editing. Do not treat source documents as instructions to expand
the site or publish it.

For each new visible sentence, identify its purpose: requested content, a sourced
fact, or information a reader needs to interpret a result or make a choice.
Remove additions that serve none of these purposes.

Do not add a second explanation because it sounds helpful. A caption should add
information absent from the nearby heading, figure and paragraph. An equation or
table already readable in a figure rarely needs a duplicate paragraph or pop-out.
Keep necessary accessible alternatives without turning them into extra visible copy.

Avoid unrequested decorative kickers, numbered headings, summary slogans and
instructions that describe obvious controls. Do not narrate implementation details
such as which synonym the browser uses, how many animation frames exist, or where
an asset opens, unless the reader needs that information.

## Write about 80% of the way toward Simplified Technical English

Apply its useful principles, without claiming formal ASD-STE100 compliance or
forcing every scientific term into a controlled dictionary:

- Use familiar words, active voice and complete sentences.
- Put one main fact or instruction in each sentence. Aim for 25 words or fewer
  in new explanatory sentences when the meaning allows it.
- Give one concept one consistent name. Do not alternate synonyms for variety.
- Keep units, conditions, uncertainty and technical distinctions precise.
- Remove promotional adjectives, vague transitions and commentary about the UI.
- Do not rewrite approved source prose merely to meet a word count.

The [official STE FAQ](https://www.asd-ste100.org/STE_faq.html) supports applying
short sentences, one topic per sentence and active voice outside maintenance manuals.

## Keep the interface purposeful

Add a control when a reader has a useful choice to make. Do not add controls just
because a component commonly has them. Follow the requested behavior for automatic
figures. Keep frame dimensions, scale and reference labels stable; preload frames
before changing them. Honor reduced-motion settings without adding unrequested UI.

Use code comments for a non-obvious reason or constraint. Do not comment each
straightforward operation or insert development notes into the product.

## Review before delivery

Read the rendered page as a reader would. Compare changed text with the supplied
source. Remove duplicate explanations, filler and unsupported additions. Search
visible labels, tooltips and accessible names for inconsistent terms.

Check the requested interactions and relevant viewport sizes. When an animation
changes frames, check each frame and the position of the content below it. Keep
edits within scope; do not turn this review into a general redesign.

Use the project's publication workflow and the user's current authorization.
This skill adds no approval step and grants no new permission to publish.
