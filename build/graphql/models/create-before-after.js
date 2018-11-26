"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createBeforeAfter;

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _replaceIdDeep = _interopRequireWildcard(require("../utils/replace-id-deep"));

var _waterfall = _interopRequireDefault(require("../../utils/waterfall"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @typedef {Object} CreateBeforeAfterOutput
 * @property {function} before
 * @property {function} after
 * @property {function[]} afterList
*/

/**
 * @function createBeforeAfter
 * @param {Object} model
 * @param {Object} options
 * @param {Object} hooks
 * @returns {CreateBeforeAfterOutput}
*/
function createBeforeAfter(model, options, hooks = {}) {
  let targetBeforeFuncs = [],
      targetAfterFuncs = [];

  if (hooks.after) {
    targetAfterFuncs = targetAfterFuncs.concat(hooks.after);
  }

  const modelDefinition = (0, _getModelDef.default)(model);
  const primaryKeys = Object.keys(model.fieldRawAttributesMap).filter(k => {
    return model.fieldRawAttributesMap[k].primaryKey;
  });
  const foreignKeys = Object.keys(model.fieldRawAttributesMap).filter(k => {
    return !!model.fieldRawAttributesMap[k].references;
  });
  modelDefinition.globalKeys = primaryKeys.concat(foreignKeys);

  if (options.before) {
    targetBeforeFuncs.push(function (params, args, context, info) {
      return options.before({
        params,
        args,
        context,
        info,
        modelDefinition,
        type: events.QUERY
      });
    });
  }

  if (options.after) {
    targetAfterFuncs.push(function (result, args, context, info) {
      return options.after({
        result,
        args,
        context,
        info,
        modelDefinition,
        type: events.QUERY
      });
    });
  }

  if (modelDefinition.before) {
    targetBeforeFuncs.push(function (params, args, context, info) {
      return modelDefinition.before({
        params,
        args,
        context,
        info,
        modelDefinition,
        type: events.QUERY
      });
    });
  }

  if (modelDefinition.after) {
    targetAfterFuncs.push(function (result, args, context, info) {
      return modelDefinition.after({
        result,
        args,
        context,
        info,
        modelDefinition: modelDefinition,
        type: events.QUERY
      });
    });
  }

  if (hooks.before) {
    targetBeforeFuncs = targetBeforeFuncs.concat(hooks.before);
  }

  const targetBefore = async (findOptions, args, context, info) => {
    findOptions.context = context;
    findOptions.rootValue = info.rootValue;

    if (findOptions.where) {
      findOptions.where = (0, _replaceIdDeep.default)(findOptions.where, modelDefinition.globalKeys, info.variableValues);
    }

    if (targetBeforeFuncs.length === 0) {
      return findOptions;
    }

    return (0, _waterfall.default)(targetBeforeFuncs, async (curr, prev) => {
      return curr(prev, args, context, info);
    }, findOptions);
  };

  const targetAfter = (result, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return result;
    }

    return (0, _waterfall.default)(targetAfterFuncs, async (curr, prev) => {
      const data = await curr(prev, args, context, info);

      if (!data) {
        return undefined;
      }

      if (data.edges) {
        data.edges = data.edges.filter(x => !!x);
      }

      return data;
    }, result);
  };

  const targetAfterArray = (results, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return results;
    }

    return (0, _waterfall.default)(results, async (result, prev) => {
      return prev.concat((await targetAfter(result, args, context, info)));
    }, []);
  };

  const events = {
    before: targetBefore,
    after: targetAfter,
    afterList: targetAfterArray
  };
  modelDefinition.events = events;
  return events;
}
//# sourceMappingURL=create-before-after.js.map
