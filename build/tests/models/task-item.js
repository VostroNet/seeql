"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _sequelize = _interopRequireDefault(require("sequelize"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  name: "TaskItem",
  define: {
    name: {
      type: _sequelize.default.STRING,
      allowNull: false,
      validate: {
        isAlphanumeric: {
          msg: "Your task item name can only use letters and numbers"
        },
        len: {
          args: [8, 50],
          msg: "Your task item name must be between 8 and 50 characters"
        }
      }
    }
  },
  relationships: [{
    type: "belongsTo",
    model: "Task",
    name: "task",
    options: {
      foreignKey: "taskId"
    }
  }],
  options: {
    tableName: "task-items",
    classMethods: {},
    hooks: {
      beforeFind(options = {}) {
        const {
          filterName
        } = options.info.rootValue || {};

        if (filterName) {
          options.where = {
            name: {
              $ne: filterName
            }
          };
        }

        return options;
      },

      beforeCreate(instance, options, cb) {
        return undefined;
      },

      beforeUpdate(instance, options, cb) {
        return undefined;
      },

      beforeDestroy(instance, options, cb) {
        return undefined;
      }

    },
    indexes: [{
      unique: true,
      fields: ["name"]
    }],
    instanceMethods: {} //TODO: figure out a way to expose this on graphql

  }
};
exports.default = _default;
//# sourceMappingURL=task-item.js.map
