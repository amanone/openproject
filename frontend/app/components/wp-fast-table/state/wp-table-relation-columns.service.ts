// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {WorkPackageTableRelationColumns} from '../wp-table-relation-columns';
import {WorkPackageResourceInterface} from '../../api/api-v3/hal-resources/work-package-resource.service';
import {WorkPackageTableColumnsService} from './wp-table-columns.service';
import {WorkPackageTableBaseService} from './wp-table-base.service';
import {
  RelationResource,
  RelationResourceInterface
} from '../../api/api-v3/hal-resources/relation-resource.service';
import {
  QueryColumn,
  queryColumnTypes,
  RelationQueryColumn,
  TypeRelationQueryColumn
} from '../../wp-query/query-column';
import {HalRequestService} from '../../api/api-v3/hal-request/hal-request.service';
import {WorkPackageCacheService} from '../../work-packages/work-package-cache.service';
import {
  RelationsStateValue,
  WorkPackageRelationsService
} from '../../wp-relations/wp-relations.service';
import {TableState} from 'core-components/wp-table/table-state/table-state';
import {QueryResource} from 'core-components/api/api-v3/hal-resources/query-resource.service';
import {Inject, Injectable} from '@angular/core';
import {halRequestToken} from 'core-app/angular4-transition-utils';
import {opServicesModule} from 'core-app/angular-modules';
import {downgradeInjectable} from '@angular/upgrade/static';

export type RelationColumnType = 'toType' | 'ofType';

@Injectable()
export class WorkPackageTableRelationColumnsService extends WorkPackageTableBaseService<WorkPackageTableRelationColumns> {
  constructor(public tableState:TableState,
              public wpTableColumns:WorkPackageTableColumnsService,
              @Inject(halRequestToken) public halRequest:HalRequestService,
              public wpCacheService:WorkPackageCacheService,
              public wpRelations:WorkPackageRelationsService) {
      super(tableState);
  }

  public get state() {
    return this.tableState.relationColumns;
  }

  public valueFromQuery(query:QueryResource):WorkPackageTableRelationColumns|undefined {
    return undefined;
  }

  public initialize() {
    this.initializeState();
  }

  /**
   * Returns a subset of all relations that the user has currently expanded.
   *
   * @param workPackage
   * @param relation
   */
  public relationsToExtendFor(workPackage:WorkPackageResourceInterface,
                              relations:RelationsStateValue|undefined,
                              eachCallback:(relation:RelationResource, column:QueryColumn, type:RelationColumnType) => void) {
    // Only if any relation columns or stored expansion state exist
    if (!this.wpTableColumns.hasRelationColumns() || this.state.isPristine()) {
      return;
    }

    // Only if any relations exist for this work package
    if (_.isNil(relations)) {
      return;
    }

    // Only if the work package has anything expanded
    const expanded = this.current.getExpandFor(workPackage.id);
    if (expanded === undefined) {
      return;
    }

    const column = this.wpTableColumns.findById(expanded)!;
    const type = this.relationColumnType(column);

    if (type !== null) {
      _.each(this.relationsForColumn(workPackage, relations, column),
        (relation) => eachCallback(relation as RelationResource, column, type));
    }
  }

  /**
   * Get the subset of relations for the work package that belong to this relation column
   *
   * @param workPackage A work package resource
   * @param relations The RelationStateValue of this work package
   * @param column The relation column to filter for
   * @return The filtered relations
   */
  public relationsForColumn(workPackage:WorkPackageResourceInterface, relations:RelationsStateValue|undefined, column:QueryColumn) {
    if (_.isNil(relations)) {
      return [];
    }

    // Get the type of TO work package
    const type = this.relationColumnType(column);
    if (type === 'toType') {
      const typeHref = (column as TypeRelationQueryColumn).type.href;

      return _.filter(relations, (relation:RelationResourceInterface) => {
        const denormalized = relation.denormalized(workPackage);
        const target = this.wpCacheService.state(denormalized.targetId).value;

        return _.get(target, 'type.href') === typeHref;
      });
    }

    // Get the relation types for OF relation columns
    if (type === 'ofType') {
      const relationType = (column as RelationQueryColumn).relationType;

      return _.filter(relations, (relation:RelationResourceInterface) => {
        return relation.denormalized(workPackage).relationType === relationType;
      });
    }

    return [];
  }

  public relationColumnType(column:QueryColumn):RelationColumnType|null {
    switch(column._type) {
      case queryColumnTypes.RELATION_TO_TYPE:
        return 'toType';
      case queryColumnTypes.RELATION_OF_TYPE:
        return 'ofType';
      default:
        return null;
    }
  }

  public getExpandFor(workPackageId:string):string | undefined {
    return this.current && this.current.getExpandFor(workPackageId);
  }

  public expandFor(workPackageId:string, columnId:string) {
    const current = this.current;

    current.expandFor(workPackageId, columnId);
    this.state.putValue(current);
  }

  public collapse(workPackageId:string) {
    const current = this.current;

    current.collapse(workPackageId);
    this.state.putValue(current);
  }

  public get current():WorkPackageTableRelationColumns {
    return this.state.value!;
  }

  private initializeState() {
    let current = this.current;

    if (!current) {
      current = new WorkPackageTableRelationColumns();
    }
    this.state.putValue(current);

    return current;
  }
}

opServicesModule.service('wpTableRelationColumns', downgradeInjectable(WorkPackageTableRelationColumnsService));
