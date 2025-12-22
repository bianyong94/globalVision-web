export interface CategoryNode {
  id: number
  name: string
  children?: CategoryNode[]
}

// ⚠️ 全局分类配置表
// 这里的 ID 必须和 config/sources.js 里的 Key 对应
export const CATEGORY_HIERARCHY: CategoryNode[] = [
  {
    id: 1,
    name: "电影",
    children: [
      { id: 5, name: "动作片" },
      { id: 6, name: "喜剧片" },
      { id: 7, name: "爱情片" },
      { id: 8, name: "科幻片" },
      { id: 9, name: "恐怖片" },
      { id: 10, name: "剧情片" },
      { id: 11, name: "战争片" },
    ],
  },
  {
    id: 2,
    name: "剧集",
    children: [
      { id: 13, name: "国产剧" },
      { id: 14, name: "港台剧" },
      { id: 15, name: "日韩剧" },
      { id: 16, name: "欧美剧" },
    ],
  },
  {
    id: 3,
    name: "综艺",
    children: [
      // 👇 这里细分了，对应 config/sources.js 里的映射
      { id: 25, name: "国产综艺" },
      { id: 26, name: "港台综艺" },
      { id: 27, name: "日韩综艺" },
      { id: 28, name: "欧美综艺" },
    ],
  },
  {
    id: 4,
    name: "动漫",
    children: [
      // 👇 这里细分了
      { id: 29, name: "国产动漫" },
      { id: 30, name: "日韩动漫" },
      { id: 31, name: "欧美动漫" },
    ],
  },
]

export const findCategoryContext = (targetId: number) => {
  for (const parent of CATEGORY_HIERARCHY) {
    if (parent.id === targetId) {
      return {
        parentId: parent.id,
        defaultChildId: parent.children ? parent.children[0].id : parent.id,
      }
    }
    if (parent.children) {
      const child = parent.children.find((c) => c.id === targetId)
      if (child) {
        return {
          parentId: parent.id,
          defaultChildId: targetId,
        }
      }
    }
  }
  // 默认回退
  return { parentId: 1, defaultChildId: 5 }
}
