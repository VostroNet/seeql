"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createMutationInputs;

var _graphql = require("graphql");

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _jsonType = _interopRequireDefault(require("graphql-sequelize/lib/types/jsonType"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * @function createMutationInputs
 * @param {Object} models
 * @param {string[]} keys
 * @param {Object} typeCollection
 * @param {Object} options
 * @returns {Object}
*/
function createMutationInput(modelName, model, gqlFields, prefix, allOptional = false) {
  const modelDefinition = (0, _getModelDef.default)(model);
  let fields = {};
  const sqlFields = model.fieldRawAttributesMap;
  Object.keys(gqlFields).forEach(fieldName => {
    const sqlField = sqlFields[fieldName];

    if (sqlField) {
      if (!sqlField._autoGenerated && !sqlField.autoIncrement) {
        //eslint-disable-line
        let gqlField = gqlFields[fieldName];

        if (allOptional) {
          if (gqlField.type instanceof _graphql.GraphQLNonNull) {
            gqlField = {
              type: gqlField.type.ofType
            };
          }
        }

        if (modelDefinition.override) {
          const overrideFieldDefinition = modelDefinition.override[fieldName];

          if (overrideFieldDefinition) {
            const fieldDefinition = modelDefinition.define[fieldName];
            const allowNull = fieldDefinition.allowNull;
            const type = overrideFieldDefinition.inputType || overrideFieldDefinition.type;
            let name = type.name;

            if (!overrideFieldDefinition.inputType) {
              name += "Input";
            }

            if (allOptional) {
              name = `Optional${name}`;
            }

            let inputType;

            if (!(overrideFieldDefinition.type instanceof _graphql.GraphQLInputObjectType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLScalarType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLEnumType)) {
              inputType = new _graphql.GraphQLInputObjectType({
                name,
                fields: type.fields
              });
            } else {
              inputType = type;
            }

            if (allowNull || allOptional || sqlFields[fieldName].primaryKey) {
              gqlField = {
                type: inputType
              };
            } else {
              gqlField = {
                type: new _graphql.GraphQLNonNull(inputType)
              };
            }
          }
        }

        if (gqlField.type instanceof _graphql.GraphQLNonNull && sqlField.defaultValue) {
          fields[fieldName] = {
            type: gqlField.type.ofType
          };
        } else if (gqlField.type instanceof _graphql.GraphQLNonNull && !sqlField.defaultValue) {
          fields[fieldName] = {
            type: new _graphql.GraphQLNonNull(gqlField.type.ofType)
          };
        } else {
          fields[fieldName] = {
            type: gqlField.type
          };
        }
      }
    }
  });
  return {
    name: `${modelName}${prefix}Input`,
    fields
  };
}

async function createMutationInputs(models, keys, typeCollection, options) {
  let inputs = keys.reduce((o, modelName) => {
    if (!typeCollection[modelName]) {
      return o;
    }

    let fields = typeCollection[modelName].$sql2gql.basicFields(); //eslint-disable-line

    o[modelName] = {
      required: createMutationInput(modelName, models[modelName], fields, "Required"),
      optional: createMutationInput(modelName, models[modelName], fields, "Optional", true)
    };
    return o;
  }, {});
  let complete = true;
  let loop = 0;

  do {
    complete = true;
    loop++;

    if (loop > 50) {
      //TODO: ??
      // go forward not going to be able to resolve any more 50 attempts should be enough
      break; //throw new Error("something went wrong, unable to finalise schema, maybe a permission setting?");
    }

    Object.keys(inputs).forEach(modelName => {
      //eslint-disable-line
      const model = models[modelName];
      let sourceType = inputs[modelName];

      if (model.relationships) {
        Object.keys(model.relationships).forEach(async relName => {
          let relationship = model.relationships[relName];
          let targetType;

          if (modelName === relationship.source) {
            targetType = sourceType;
          } else {
            targetType = inputs[relationship.source];
          }

          if (targetType) {
            let createType, updateType;
            const createInput = new _graphql.GraphQLInputObjectType({
              name: `${sourceType.required.name}${relName}Create`,
              fields: targetType.required.fields
            });
            const updateInput = new _graphql.GraphQLInputObjectType({
              name: `${sourceType.optional.name}${relName}Update`,
              fields: {
                where: {
                  type: _jsonType.default
                },
                input: {
                  type: new _graphql.GraphQLInputObjectType({
                    name: `${sourceType.optional.name}${relName}UpdateInput`,
                    fields: targetType.optional.fields
                  })
                }
              }
            });

            switch (relationship.type) {
              case "hasMany":
              case "belongsToMany":
                createType = new _graphql.GraphQLList(createInput);
                updateType = new _graphql.GraphQLList(updateInput);
                break;

              default:
                createType = createInput;
                updateType = updateInput;
                break;
            }

            const input = new _graphql.GraphQLInputObjectType({
              name: `${sourceType.required.name}${relName}`,
              fields: {
                create: {
                  type: createType
                },
                update: {
                  type: updateType
                }
              }
            });

            switch (relationship.type) {
              case "belongsToMany": //eslint-disable-line

              case "hasMany":
                inputs[modelName].required.fields[relName] = {
                  type: new _graphql.GraphQLList(input)
                };
                inputs[modelName].optional.fields[relName] = {
                  type: new _graphql.GraphQLList(input)
                };
                break;

              default:
                inputs[modelName].required.fields[relName] = {
                  type: input
                };
                inputs[modelName].optional.fields[relName] = {
                  type: input
                };
                break;
            }
          } else {
            complete = false;
          }
        });
      }
    });
  } while (!complete);

  return Object.keys(inputs).reduce((o, k) => {
    return _objectSpread({}, o, {
      [k]: {
        required: new _graphql.GraphQLInputObjectType(inputs[k].required),
        optional: new _graphql.GraphQLInputObjectType(inputs[k].optional)
      }
    });
  }, {});
}
//# sourceMappingURL=create-input.js.map
