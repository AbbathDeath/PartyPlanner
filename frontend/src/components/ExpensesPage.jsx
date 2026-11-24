import {Link, useParams } from 'react-router'
import { useState } from 'react'


const test_names = [
    {id: "n1", name: "test1" },
    {id: "n2", name: "test2" },
    {id: "n3", name: "test3" },

]

const test_orders = [
    { id: 1, title: "Pizza", amount: 6000, paid_by: "n1"},
    { id: 2, title: "Piwko", amount: 4000,  paid_by: "n2"},
    { id: 3, title: "Inne zakupy", amount: 12000, paid_by: "n3"}
]

const formatPLN = (grosze) =>
    (grosze / 100).toLocaleString('pl-PL', {style: 'currency', currency: 'PLN'})



const ExpensesPage = () => {

    const { id } = useParams() 
    const [showForm, setShowForm] = useState(false)
    const [expenseTitle, setExpenseTitle] = useState("")
    const [expenseAmount, setExpenseAmount] = useState("")
    const [expensePaidBy, setExpensePaidBy] = useState("")
    const [selectedMembers, setSelectedMembers] = useState(test_names.map((member) => member.id))
    const [splitMode, setSplitMode] = useState("equal")
    const [manualSplit, setManualSplit] = useState({})
    
    const toggleMember = (memberId) => {
        if (selectedMembers.includes(memberId)) {
            setSelectedMembers(selectedMembers.filter((o) => o !== memberId))
        } else {
            setSelectedMembers([...selectedMembers, memberId])
        }
    }

    const totalGrosze = Math.round(Number(expenseAmount) * 100)
    const base = selectedMembers.length > 0 ? Math.floor(totalGrosze / selectedMembers.length) : 0
    const remainder = selectedMembers.length > 0? totalGrosze % selectedMembers.length : 0

    const shareOf = (memberId) => {
        if (!selectedMembers.includes(memberId)) return 0
        if (splitMode === "manual") {
            return Math.round(Number(manualSplit[memberId] || 0) * 100)
        }
        const index = selectedMembers.indexOf(memberId)
        if (index === -1) return 0
        return index < remainder ? base + 1: base
    }

    const sharesSum = selectedMembers.reduce((sum, memberId) => sum + shareOf(memberId), 0)

    const updateMemberShare = (memberId, value) => {
        setManualSplit({...manualSplit, [memberId]: value})
    }

    const showShare = (share) => {
        if (!selectedMembers.includes(share.id)) {
            return <span className="text-gray-600"> - </span>
        }

        if (splitMode === "equal") {
            return <span> {formatPLN(shareOf(share.id))} </span>
        }
        return (
            <input
            type="number"
            step="0.01"
            min="0"
            value={manualSplit[share.id] || ""}
            onChange={(e) => updateMemberShare(share.id, e.target.value)}
            className="w-24 p-1 border rounded text-right"
            />
        )
    }


  return (
    <div className="max-w-md mx-auto pt-24">
      <div className="border rounded-lg shadow-md p-6">
        <Link to={`/groups/${id}`}className="text-green-600 underline hover:text-green-800 mt-4">
                    ← Wróć do grupy
                </Link>
        <h1 className="text-2xl font-bold mt-4">Wydatki</h1>

        <ul className="flex flex-col gap-1 mt-4">
            {test_orders.map((order) => (
                <li key={order.id} className="flex justify-between border-b py-1">
                    <div>
                        <div>{order.title}</div>
                        <div className="text-sm text-gray-600">
                            zapłacił(a): {test_names.find((item) => item.id === order.paid_by)?.name}
                        </div>
                    </div>
                    <span>{formatPLN(order.amount)}</span>
                </li>
            ))}
        </ul>

        <button onClick = {() => setShowForm(!showForm)} className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 cursor-pointer" >
            {showForm ? "Anuluj" : "Dodaj wydatek"}
        </button>

        {showForm && (
            <div className="border rounded-lg p-4 mt-4">
                <h3 className="font-bold">Dodaj wydatek</h3>
                <label className="block text-sm text-gray-600 mt-3">Tytuł</label>
                <input
                        value={expenseTitle}
                        onChange={(e) => setExpenseTitle(e.target.value)}
                        className='p-3 mt-1 border rounded w-full'
                        type='text'
                        placeholder="np. Piwo">
                </input>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mt-3">Kwota (zł)</label>
                        <input
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            className='p-3 mt-1 border rounded w-full'
                            type="number"
                            step="0.01"
                            min="0">
                        </input>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mt-3">Kto płacił</label>
                        <select 
                            className="p-3 mt-1 w-full border rounded"
                            value={expensePaidBy}
                            onChange={(e) => setExpensePaidBy(e.target.value)}
                        >
                            <option value="">Wybierz płacącego</option>
                            {test_names.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                        ))}
                    </select>
                    </div>
                </div>
                <div className='flex gap-2 mt-3'>
                    <button
                        type="button"
                        onClick={() => setSplitMode("equal")}
                        className={splitMode === "equal" ? "bg-green-600 text-white px-3 py-1 rounded" : "border px-3 py-1 rounded"}
                    >
                        Równo
                    </button>  

                    <button
                        type="button"
                        onClick={() => setSplitMode("manual")}
                        className={splitMode === "manual" ? "bg-green-600 text-white px-3 py-1 rounded" : "border px-3 py-1 rounded"}
                    >
                        Ręcznie
                    </button>  
                </div>

                <label className="block text-sm text-gray-600 mt-3">Uczestnicy</label>
                <div>
                    {test_names.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-1">
                            <label className="flex items-center gap-2">
                            <input 
                                type = "checkbox"
                                checked = {selectedMembers.includes(item.id)}
                                onChange = {() => toggleMember(item.id)}
                                />
                                {item.name}
                            </label>
                            {showShare(item)}
                        </div>
                    ))}
                    <p className="text-sm text-gray-600 mt-2">
                        Podzielono: {formatPLN(sharesSum)} z {formatPLN(totalGrosze)}
                    </p>
                </div>
            </div>
        )}

      </div>
    </div>
  )
}

export default ExpensesPage