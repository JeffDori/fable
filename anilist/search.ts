import { json } from '../index.ts';

import { capitalize } from '../utils.ts';

import * as discord from '../discord.ts';

import * as anilist from './api.ts';

export async function searchPage(
  { id, search }: {
    id?: number;
    search?: string;
  },
  type = discord.MESSAGE_TYPE.NEW,
) {
  try {
    const results = await anilist.search(id ? { id } : { search });

    if (!results.media.length) {
      throw new Error('404');
    }

    const media = results.media[0];

    const titles = [
      media.title.english,
      media.title.romaji,
      media.title.native,
    ].filter(Boolean);

    const message: discord.Message = new discord.Message(type);

    message.addEmbed(
      new discord.Embed()
        .setTitle(titles.shift()!)
        .setAuthor(capitalize(media.type!))
        .setDescription(media.description)
        .setColor(media.coverImage?.color)
        .setImage(
          media.coverImage?.extraLarge,
        )
        .setFooter(titles.join(' - ')),
    );

    media.characters?.edges.slice(0, 2).forEach((character) => {
      const embed = new discord.Embed()
        .setTitle(character.node.name.full)
        .setDescription(character.node.description)
        .setColor(media.coverImage?.color)
        .setThumbnail(character.node.image?.large)
        .setFooter(
          [
            character.node.gender,
            character.node.age,
          ].filter(Boolean).join('. '),
          '.',
        );

      message.addEmbed(embed);
    });

    const group: discord.Component[] = [];

    media.relations?.edges.forEach((relation) => {
      const component = new discord.Component()
        .setStyle(discord.BUTTON_COLOR.GREY);

      switch (relation.relationType) {
        case anilist.RELATION_TYPE.PREQUEL:
        case anilist.RELATION_TYPE.SEQUEL:
        case anilist.RELATION_TYPE.SIDE_STORY:
        case anilist.RELATION_TYPE.SPIN_OFF:
          component.setLabel(capitalize(relation.relationType!));
          break;
        default:
          component.setLabel(capitalize(relation.node.format!));
          break;
      }

      switch (relation.node.format) {
        case anilist.FORMAT.MUSIC:
          component.setLabel(
            (relation.node.title.english || relation.node.title.romaji ||
              relation.node.title.native)!,
          );
          component.setUrl(relation.node.externalLinks?.shift()?.url!);
          break;
        default:
          component.setId(`${relation.node.id!}`);
          break;
      }

      group.push(component);
    });

    message.addComponent(...group);

    return json(message.done());
  } catch (err) {
    if (err?.response?.status === 404 || err?.message === '404') {
      return json(JSON.stringify({
        type,
        data: {
          content: 'Found nothing matching that name!',
        },
      }));
    }

    return json(JSON.stringify({
      type,
      data: {
        content: JSON.stringify(err),
      },
    }));
  }
}
