import Database from "../../src/database";
import SequelizeAdapter from "../../src/adapters/sequelize";
import createRelatedFieldsFunc from "../../src/graphql/create-related-fields";
import {GraphQLObjectType} from "graphql";
test("createRelatedFieldsFunc - empty define", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }), "sqlite");
  const itemDef = {
    name: "Item",
    define: {},
    relationships: [{
      model: "Item",
      type: "hasMany",
      name: "children",
      options: {
        as: "children",
        foreignKey: "parentId",
      },
    }, {
      model: "Item",
      type: "belongsTo",
      name: "parent",
      options: {
        as: "parent",
        foreignKey: "parentId",
      },
    }],
  };
  await db.addDefinition(itemDef);
  await db.initialise();
  const func = createRelatedFieldsFunc(itemDef.name, db, itemDef, {}, {
    types: {
      "Item": new GraphQLObjectType({
        name: "Item",
      })
    },
    lists: {}
  });
  expect(func).toBeInstanceOf(Function);
  const fields = func();
  expect(fields).toBeDefined();
  // expect(fields.id).toBeDefined();
  // expect(fields.id.type).toBeInstanceOf(GraphQLNonNull);
  // expect(fields.id.type.ofType).toEqual(GraphQLID);
});