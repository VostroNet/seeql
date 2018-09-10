"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createModelTypes;

var _graphql = require("graphql");

var _graphqlSequelize = require("graphql-sequelize");

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _createBeforeAfter = _interopRequireDefault(require("./create-before-after"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const {
  sequelizeConnection
} = _graphqlSequelize.relay;

async function createModelTypes(models, keys, prefix = "", options, nodeInterface) {
  const result = await keys.reduce((promise, modelName) => {
    return promise.then(async o => {
      o[modelName] = await createModelType(modelName, models, prefix, options, nodeInterface, o);
      return o;
    });
  }, Promise.resolve({}));
  return result;
}

async function createModelType(modelName, models, prefix = "", options = {}, nodeInterface, typeCollection) {
  if (options.permission) {
    if (options.permission.model) {
      const result = await options.permission.model(modelName);

      if (!result) {
        // console.log("exluding", modelName);
        return undefined;
      }
    }
  }

  const model = models[modelName];
  const modelDefinition = (0, _getModelDef.default)(model);
  let resolve;

  if (modelDefinition.resolver) {
    resolve = modelDefinition.resolver;
  } else {
    const {
      before,
      after
    } = (0, _createBeforeAfter.default)(model, options);
    resolve = (0, _graphqlSequelize.resolver)(model, {
      before,
      after
    });
  }

  function basicFields() {
    let exclude = Object.keys(modelDefinition.override || {}).concat(modelDefinition.ignoreFields || []);

    if (options.permission) {
      if (options.permission.field) {
        exclude = exclude.concat(Object.keys(model.rawAttributes).filter(keyName => !options.permission.field(modelName, keyName)));
      }
    }

    let fieldDefinitions = (0, _graphqlSequelize.attributeFields)(model, {
      exclude,
      globalId: true //TODO: need to add check for primaryKey field as exclude ignores it if this is true.

    });
    const foreignKeys = Object.keys(model.fieldRawAttributesMap).filter(k => {
      return !!model.fieldRawAttributesMap[k].references;
    });

    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        if (!fieldDefinitions[fk]) {
          return;
        }

        if (model.fieldRawAttributesMap[fk].allowNull) {
          fieldDefinitions[fk].type = _graphql.GraphQLString;
        } else {
          fieldDefinitions[fk].type = new _graphql.GraphQLNonNull(_graphql.GraphQLString);
        }
      });
    }

    if (modelDefinition.override) {
      Object.keys(modelDefinition.override).forEach(fieldName => {
        if (options.permission) {
          if (options.permission.field) {
            if (!options.permission.field(modelName, fieldName)) {
              return;
            }
          }
        }

        const fieldDefinition = modelDefinition.define[fieldName];

        if (!fieldDefinition) {
          throw new Error(`Unable to find the field definition for ${modelName}->${fieldName}. Please check your model definition for invalid configuration.`);
        }

        const overrideFieldDefinition = modelDefinition.override[fieldName];
        let type;

        if (!(overrideFieldDefinition.type instanceof _graphql.GraphQLObjectType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLScalarType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLEnumType)) {
          type = new _graphql.GraphQLObjectType(overrideFieldDefinition.type);
        } else {
          type = overrideFieldDefinition.type;
        }

        if (!fieldDefinition.allowNull) {
          type = new _graphql.GraphQLNonNull(type);
        }

        fieldDefinitions[fieldName] = {
          type,
          resolve: overrideFieldDefinition.output
        };
      });
    }

    return fieldDefinitions;
  }

  function complexFields() {
    let fieldDefinitions = {};

    if (models[modelName].relationships) {
      if (typeCollection[modelName]) {
        Object.keys(models[modelName].relationships).forEach(relName => {
          let relationship = models[modelName].relationships[relName];
          let targetType = typeCollection[relationship.source]; // let mutationFunction = mutationFunctions[relationship.source];

          if (!targetType) {
            return;
          }

          if (options.permission) {
            if (options.permission.relationship) {
              const result = options.permission.relationship(modelName, relName, relationship.source, options.permission.options); //TODO move this outside to resolve via promise

              if (!result) {
                return;
              }
            }
          }

          const {
            before,
            after,
            afterList
          } = (0, _createBeforeAfter.default)(models[modelName], options); //eslint-disable-line

          if (!targetType) {
            throw `targetType ${targetType} not defined for relationship`;
          }

          const modelDefinition = (0, _getModelDef.default)(models[targetType.name]);
          const orderByValues = Object.keys(modelDefinition.define).reduce((obj, field) => {
            return Object.assign({}, obj, {
              [`${field}Asc`]: {
                value: [field, "ASC"]
              },
              [`${field}Desc`]: {
                value: [field, "DESC"]
              }
            });
          }, {
            idAsc: {
              value: ["id", "ASC"]
            },
            idDesc: {
              value: ["id", "DESC"]
            },
            createdAtAsc: {
              value: ["createdAt", "ASC"]
            },
            createdAtDesc: {
              value: ["createdAt", "DESC"]
            },
            updatedAtAsc: {
              value: ["updatedAt", "ASC"]
            },
            updatedAtDesc: {
              value: ["updatedAt", "DESC"]
            }
          });
          let conn = sequelizeConnection({
            name: `${modelName}${relName}`,
            nodeType: targetType,
            target: relationship.rel,
            orderBy: new _graphql.GraphQLEnumType({
              name: `${modelName}${relName}OrderBy`,
              values: orderByValues
            }),
            // edgeFields: def.edgeFields,
            // connectionFields: def.connectionFields,
            where: (key, value, currentWhere) => {
              // for custom args other than connectionArgs return a sequelize where parameter
              if (key === "where") {
                return value;
              }

              return {
                [key]: value
              };
            },

            async before(findOptions, args, context, info) {
              const options = await before(findOptions, args, context, info);
              const {
                source
              } = info;
              const model = models[modelName];
              const assoc = model.associations[relName];
              options.where = {
                $and: [{
                  [assoc.foreignKey]: source.get(assoc.sourceKey)
                }, options.where]
              };
              return options;
            },

            after
          });

          switch (relationship.type) {
            case "belongsToMany":
              //eslint-disable-line
              conn = sequelizeConnection({
                name: `${modelName}${relName}`,
                nodeType: targetType,
                target: relationship.rel,
                where: (key, value, currentWhere) => {
                  if (key === "where") {
                    return value;
                  }

                  return {
                    [key]: value
                  };
                },

                before(findOptions, args, context, info) {
                  // const {source} = info;
                  const model = models[modelName];
                  const assoc = model.associations[relName];

                  if (!findOptions.include) {
                    findOptions.include = [];
                  }

                  findOptions.include.push({
                    model: assoc.source,
                    as: assoc.paired.as
                  });
                  return before(findOptions, args, context, info);
                },

                after
              });
              fieldDefinitions[relName] = {
                type: conn.connectionType,
                args: _objectSpread({}, conn.connectionArgs, {
                  where: {
                    type: _graphqlSequelize.JSONType.default
                  }
                }),
                resolve: conn.resolve
              };
              break;

            case "hasMany":
              fieldDefinitions[relName] = {
                type: conn.connectionType,
                args: _objectSpread({}, conn.connectionArgs, {
                  where: {
                    type: _graphqlSequelize.JSONType.default
                  }
                }),
                resolve: conn.resolve
              };
              break;

            case "hasOne": //eslint-disable-line

            case "belongsTo":
              fieldDefinitions[relName] = {
                type: targetType,
                resolve: (0, _graphqlSequelize.resolver)(relationship.rel, {
                  before,
                  after
                })
              };
              break;

            default:
              throw "Unhandled Relationship type";
          }
        });
      }
    }

    if (((modelDefinition.expose || {}).instanceMethods || {}).query) {
      const instanceMethods = modelDefinition.expose.instanceMethods.query;
      Object.keys(instanceMethods).forEach(methodName => {
        const {
          type,
          args
        } = instanceMethods[methodName]; // const {type, args} = instanceMethod;

        let targetType = type instanceof String || typeof type === "string" ? typeCollection[type] : type;

        if (!targetType) {
          //target does not exist.. excluded from base types?
          return;
        }

        if (options.permission) {
          if (options.permission.queryInstanceMethods) {
            const result = options.permission.queryInstanceMethods(modelName, methodName, options.permission.options);

            if (!result) {
              return;
            }
          }
        }

        fieldDefinitions[methodName] = {
          type: targetType,
          args,
          resolve: (source, args, context, info) => {
            return source[methodName].apply(source, [args, context, info]);
          }
        };
      });
    }

    return fieldDefinitions;
  }

  const obj = new _graphql.GraphQLObjectType({
    name: `${prefix}${modelName}`,
    description: "",

    fields() {
      return Object.assign({}, basicFields(), complexFields());
    },

    resolve,
    interfaces: [nodeInterface]
  });
  obj.basicFields = basicFields;
  obj.complexFields = complexFields;
  typeCollection[`${modelName}[]`] = new _graphql.GraphQLList(obj);
  return obj;
}
//# sourceMappingURL=create-new.js.map
