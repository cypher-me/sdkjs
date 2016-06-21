/*
 * (c) Copyright Ascensio System SIA 2010-2016
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at Lubanas st. 125a-25, Riga, Latvia,
 * EU, LV-1021.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

"use strict";

/**
 * Класс, работающий со сносками документа.
 * @param {CDocument} LogicDocument - Ссылка на главный документ.
 * @constructor
 * @extends {CDocumentControllerBase}
 */
function CFootnotesController(LogicDocument)
{
	CFootnotesController.superclass.constructor.call(this, LogicDocument);

	this.Id = LogicDocument.Get_IdCounter().Get_NewId();

	this.Footnote = {}; // Список всех сносок с ключом - Id.
	this.Pages    = [];

	// Специальные сноски
	this.ContinuationNoticeFootnote    = null;
	this.ContinuationSeparatorFootnote = null;
	this.SeparatorFootnote             = null;

	this.Selection = {
		Use      : false,
		Footnotes : [],
		Direction : 0
	};

	this.CurFootnote = null;

	// Добавляем данный класс в таблицу Id (обязательно в конце конструктора)
	LogicDocument.Get_TableId().Add(this, this.Id);
}

AscCommon.extendClass(CFootnotesController, CDocumentControllerBase);

/**
 * Получаем Id данного класса.
 */
CFootnotesController.prototype.Get_Id = function()
{
	return this.Id;
};
/**
 * Начальная инициализация после загрузки всех файлов.
 */
CFootnotesController.prototype.Init = function()
{
	this.SeparatorFootnote = new CFootEndnote(this);
	this.SeparatorFootnote.Paragraph_Add(new ParaSeparator(), false);
	this.SeparatorFootnote.Paragraph_Add(new ParaText("1"), false);
	this.SeparatorFootnote.Paragraph_Add(new ParaText("2"), false);
	this.SeparatorFootnote.Paragraph_Add(new ParaText("3"), false);

	var oParagraph = this.SeparatorFootnote.Get_ElementByIndex(0);
	oParagraph.Set_Spacing({After : 0, Line : 1, LineRule : Asc.linerule_Auto}, false);
};
/**
 * Создаем новую сноску.
 * @returns {CFootEndnote}
 */
CFootnotesController.prototype.Create_Footnote = function()
{
	var NewFootnote                     = new CFootEndnote(this);
	this.Footnote[NewFootnote.Get_Id()] = NewFootnote;
	return NewFootnote;
};
/**
 * Сбрасываем рассчетные данный для заданной страницы.
 * @param {number} nPageIndex
 */
CFootnotesController.prototype.Reset = function(nPageIndex)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	this.Pages[nPageIndex].Reset();
};
/**
 * Пересчитываем сноски на заданной странице.
 */
CFootnotesController.prototype.Recalculate = function(nPageIndex, X, XLimit, Y, YLimit)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	// Мы пересчет начинаем с 0, потом просто делаем сдвиг, через функцию Shift.

	var CurY = Y;

	if (null !== this.SeparatorFootnote)
	{
		this.SeparatorFootnote.Reset(X, CurY, XLimit, 10000);
		this.SeparatorFootnote.Recalculate_Page(0, true);
		this.Pages[nPageIndex].SeparatorRecalculateObject = this.SeparatorFootnote.Save_RecalculateObject();

		var Bounds = this.SeparatorFootnote.Get_PageBounds(0);
		CurY += Bounds.Bottom - Bounds.Top;
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Reset(X, CurY, XLimit, 10000);

		var CurPage      = 0;
		var RecalcResult = recalcresult2_NextPage;
		while (recalcresult2_End != RecalcResult)
			RecalcResult = Footnote.Recalculate_Page(CurPage++, true);

		var Bounds = Footnote.Get_PageBounds(0);
		CurY += Bounds.Bottom - Bounds.Top;
	}
};
/**
 * Получаем суммарную высоту, занимаемую сносками на заданной странице.
 * @param {number} nPageIndex
 * @returns {number}
 */
CFootnotesController.prototype.Get_Height = function(nPageIndex)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return 0;

	var nHeight = 0;

	if (null !== this.SeparatorFootnote)
	{
		var Bounds = this.SeparatorFootnote.Get_PageBounds(0);
		nHeight += Bounds.Bottom - Bounds.Top;
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		var Bounds   = Footnote.Get_PageBounds(0);
		nHeight += Bounds.Bottom - Bounds.Top;
	}

	return nHeight;
};
/**
 * Отрисовываем сноски на заданной странице.
 * @param {number} nPageIndex
 * @param {CGraphics} pGraphics
 */
CFootnotesController.prototype.Draw = function(nPageIndex, pGraphics)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	if (null !== this.SeparatorFootnote && null !== this.Pages[nPageIndex].SeparatorRecalculateObject)
	{
		this.SeparatorFootnote.Load_RecalculateObject(this.Pages[nPageIndex].SeparatorRecalculateObject);
		this.SeparatorFootnote.Draw(0, pGraphics);
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Draw(0, pGraphics);
	}
};
/**
 * Сдвигаем все рассчитанные позиции на заданной странице.
 * @param {number} nPageIndex
 * @param {number} dX
 * @param {number} dY
 */
CFootnotesController.prototype.Shift = function(nPageIndex, dX, dY)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	if (null !== this.SeparatorFootnote && null !== this.Pages[nPageIndex].SeparatorRecalculateObject)
	{
		this.SeparatorFootnote.Load_RecalculateObject(this.Pages[nPageIndex].SeparatorRecalculateObject);
		this.SeparatorFootnote.Shift(0, dX, dY);
		this.Pages[nPageIndex].SeparatorRecalculateObject = this.SeparatorFootnote.Save_RecalculateObject();
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Shift(0, dX, dY);
	}
};
/**
 * Добавляем заданную сноску на страницу для пересчета.
 * @param {number} nPageIndex
 * @param {CFootEndnote} oFootnote
 */
CFootnotesController.prototype.Add_FootnoteOnPage = function(nPageIndex, oFootnote)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	this.Pages[nPageIndex].Elements.push(oFootnote);
};
/**
 * Проверяем, используется заданная сноска в документе.
 * @param {string} sFootnoteId
 * @returns {boolean}
 */
CFootnotesController.prototype.Is_UseInDocument = function(sFootnoteId)
{
	// TODO: Надо бы еще проверить, если ли в документе ссылка на данную сноску.
	for (var sId in this.Footnote)
	{
		if (sId === sFootnoteId)
			return true;
	}

	return false;
};
/**
 * Проверяем пустая ли страница.
 * @param {number} nPageIndex
 * @returns {boolean}
 */
CFootnotesController.prototype.Is_EmptyPage = function(nPageIndex)
{
	if (!this.Pages[nPageIndex] || this.Pages[nPageIndex].Elements.length <= 0)
		return true;

	return false;
};

CFootnotesController.prototype.Refresh_RecalcData2 = function(nRelPageIndex)
{
	var nAbsPageIndex = nRelPageIndex;
	if (this.LogicDocument.Pages[nAbsPageIndex])
	{
		var nIndex = this.LogicDocument.Pages[nAbsPageIndex].Pos;
		this.LogicDocument.Refresh_RecalcData2(nIndex, nAbsPageIndex);
	}
};
CFootnotesController.prototype.Get_PageContentStartPos = function(PageAbs)
{
	//TODO: Реализовать
	return {X : 0, Y : 0, XLimit : 0, YLimit : 0};
};

//----------------------------------------------------------------------------------------------------------------------
// Интерфейс CDocumentControllerBase
//----------------------------------------------------------------------------------------------------------------------
CFootnotesController.prototype.CanTargetUpdate = function()
{
	return true;
};
CFootnotesController.prototype.RecalculateCurPos = function()
{
	if (null !== this.CurFootnote)
		this.CurFootnote.RecalculateCurPos();
};
CFootnotesController.prototype.GetCurPage = function()
{
	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{

	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Get_StartPage_Absolute();
	}

	return -1;
};
CFootnotesController.prototype.AddNewParagraph = function(bRecalculate, bForceAdd)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Add_NewParagraph(bRecalculate, bForceAdd);
	}

	return bRetValue;
};
CFootnotesController.prototype.AddInlineImage = function(nW, nH, oImage, oChart, bFlow)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Add_InlineImage(nW, nH, oImage, oChart, bFlow);
	}

	return bRetValue;
};
CFootnotesController.prototype.AddOleObject = function(W, H, nWidthPix, nHeightPix, Img, Data, sApplicationId)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Add_OleObject(W, H, nWidthPix, nHeightPix, Img, Data, sApplicationId);
	}

	return bRetValue;
};
CFootnotesController.prototype.AddTextArt = function(nStyle)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Add_TextArt(nStyle);
	}

	return bRetValue;
};
CFootnotesController.prototype.EditChart = function(Chart)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.AddInlineTable = function(Cols, Rows)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Add_InlineTable(Cols, Rows);
	}
};
CFootnotesController.prototype.ClearParagraphFormatting = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_ClearFormatting();
	}
};
CFootnotesController.prototype.Remove = function(Count, bOnlyText, bRemoveOnlySelection, bOnTextAdd)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Remove(Count, bOnlyText, bRemoveOnlySelection, bOnTextAdd);
	}
};
CFootnotesController.prototype.GetCursorPosXY = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Cursor_GetPos();
	}

	return {X : 0, Y : 0}
};
CFootnotesController.prototype.MoveCursorToStartPos = function(AddToSelect)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.MoveCursorToEndPos = function(AddToSelect)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.MoveCursorLeft = function(AddToSelect, Word)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveLeft(AddToSelect, Word);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorRight = function(AddToSelect, Word, FromPaste)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveRight(AddToSelect, Word, FromPaste);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorUp = function(AddToSelect)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveUp(AddToSelect);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorDown = function(AddToSelect)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveDown(AddToSelect);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorToEndOfLine = function(AddToSelect)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveEndOfLine(AddToSelect);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorToStartOfLine = function(AddToSelect)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveStartOfLine(AddToSelect);
	}

	return bRetValue;
};
CFootnotesController.prototype.MoveCursorToXY = function(X, Y, PageAbs, AddToSelect)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.MoveCursorToCell = function(bNext)
{
	var bRetValue = false;

	// TODO: Доделать селект и курсор

	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			bRetValue = this.CurFootnote.Cursor_MoveToCell(bNext);
	}

	return bRetValue;
};
CFootnotesController.prototype.SetParagraphAlign = function(Align)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphAlign(Align);
	}
};
CFootnotesController.prototype.SetParagraphSpacing = function(Spacing)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphSpacing(Spacing);
	}
};
CFootnotesController.prototype.SetParagraphTabs = function(Tabs)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphTabs(Tabs);
	}
};
CFootnotesController.prototype.SetParagraphIndent = function(Ind)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphIndent(Ind);
	}
};
CFootnotesController.prototype.SetParagraphNumbering = function(NumInfo)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphNumbering(NumInfo);
	}
};
CFootnotesController.prototype.SetParagraphShd = function(Shd)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphShd(Shd);
	}

};
CFootnotesController.prototype.SetParagraphStyle = function(Name)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphStyle(Name);
	}
};
CFootnotesController.prototype.SetParagraphContextualSpacing = function(Value)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphContextualSpacing(Value);
	}
};
CFootnotesController.prototype.SetParagraphPageBreakBefore = function(Value)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphPageBreakBefore(Value);
	}
};
CFootnotesController.prototype.SetParagraphKeepLines = function(Value)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphKeepLines(Value);
	}
};
CFootnotesController.prototype.SetParagraphKeepNext = function(Value)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphKeepNext(Value);
	}
};
CFootnotesController.prototype.SetParagraphWidowControl = function(Value)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphWidowControl(Value);
	}
};
CFootnotesController.prototype.SetParagraphBorders = function(Borders)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ParagraphBorders(Borders);
	}
};
CFootnotesController.prototype.SetParagraphFramePr = function(FramePr, bDelete)
{
	// TODO: Реализовать, скорее всего ничего тут не надо делать
};
CFootnotesController.prototype.IncreaseOrDecreaseParagraphFontSize = function(bIncrease)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_IncDecFontSize(bIncrease);
	}
};
CFootnotesController.prototype.IncreaseOrDecreaseParagraphIndent = function(bIncrease)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_IncDecIndent(bIncrease);
	}
};
CFootnotesController.prototype.SetImageProps = function(Props)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_ImageProps(Props);
	}
};
CFootnotesController.prototype.SetTableProps = function(Props)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Set_TableProps(Props);
	}
};
CFootnotesController.prototype.GetCurrentParaPr = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Get_Paragraph_ParaPr();
	}

	return null;
};
CFootnotesController.prototype.GetCurrentTextPr = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Get_Paragraph_TextPr();
	}

	return null;
};
CFootnotesController.prototype.GetDirectParaPr = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Get_Paragraph_ParaPr_Copy();
	}

	return null;
};
CFootnotesController.prototype.GetDirectTextPr = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Get_Paragraph_TextPr_Copy();
	}

	return null;
};
CFootnotesController.prototype.RemoveSelection = function(bNoCheckDrawing)
{
	// TODO: Доделать селект и курсор
};
CFootnotesController.prototype.IsEmptySelection = function(bCheckHidden)
{
	// TODO: Доделать селект и курсор
	return true;
};
CFootnotesController.prototype.DrawSelectionOnPage = function(PageAbs)
{
	// TODO: Доделать селект и курсор
};
CFootnotesController.prototype.GetSelectionBounds = function()
{
	// TODO: Доделать селект и курсор
	return null;
};
CFootnotesController.prototype.IsMovingTableBorder = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Selection_Is_TableBorderMove();
	}

	return false;
};
CFootnotesController.prototype.CheckPosInSelection = function(X, Y, PageAbs, NearPos)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			return this.CurFootnote.Selection_Check(X, Y, PageAbs, NearPos);
	}

	return false;
};
CFootnotesController.prototype.SelectAll = function()
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Select_All();
	}
};
CFootnotesController.prototype.GetSelectedContent = function(SelectedContent)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Get_SelectedContent(SelectedContent);
	}
};
CFootnotesController.prototype.UpdateCursorType = function(X, Y, PageAbs, MouseEvent)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Update_CursorType(X, Y, PageAbs, MouseEvent);
	}
};
CFootnotesController.prototype.PasteFormatting = function(TextPr, ParaPr)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_Format_Paste(TextPr, ParaPr, true);
	}
};
CFootnotesController.prototype.IsSelectionUse = function()
{
	// TODO: Добавить селект
	return false;
};
CFootnotesController.prototype.IsTextSelectionUse = function()
{
	// TODO: Реализовать
	return false;
};
CFootnotesController.prototype.GetCurPosXY = function()
{
	// TODO: Реализовать
	return {X : 0, Y : 0};
};
CFootnotesController.prototype.GetSelectedText = function(bClearText)
{
	// TODO: Реализовать
	return "";
};
CFootnotesController.prototype.GetCurrentParagraph = function()
{
	// TODO: Реализовать
	return null;
};
CFootnotesController.prototype.GetSelectedElementsInfo = function(oInfo)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.AddTableRow = function(bBefore)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.AddTableCol = function(bBefore)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.RemoveTableRow = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.RemoveTableCol = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.MergeTableCells = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.SplitTableCells = function(Cols, Rows)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.RemoveTable = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.SelectTable = function(Type)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.CanMergeTableCells = function()
{
	// TODO: Реализовать
	return false;
};
CFootnotesController.prototype.CanSplitTableCells = function()
{
	// TODO: Реализовать
	return false;
};

CFootnotesController.prototype.AddToParagraph = function(oItem, bRecalculate)
{
	// TODO: Доделать селект и курсор
	if (true === this.Selection.Use)
	{
	}
	else
	{
		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_Add(oItem, bRecalculate);
	}
};



function CFootEndnotePage()
{
	this.X      = 0;
	this.Y      = 0;
	this.XLimit = 0;
	this.YLimit = 0;

	this.Elements = [];

	this.SeparatorRecalcObject             = null;
	this.ContinuationSeparatorRecalcObject = null;
	this.ContinuationNoticeRecalcObject    = null;
}
CFootEndnotePage.prototype.Reset = function()
{
	this.X      = 0;
	this.Y      = 0;
	this.XLimit = 0;
	this.YLimit = 0;

	this.Elements = [];

	this.SeparatorRecalcObject             = null;
	this.ContinuationSeparatorRecalcObject = null;
	this.ContinuationNoticeRecalcObject    = null;
};





