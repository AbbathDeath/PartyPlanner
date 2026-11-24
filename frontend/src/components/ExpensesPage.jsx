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
        const index = selectedMembers.indexOf(memberId)
        if (index === -1) return 0
        return index < remainder ? base + 1: base
    }

    const sharesSum = selectedMembers.reduce((sum, memberId) => sum + shareOf(memberId), 0)

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
                            <span className="text-gray-600">{selectedMembers.includes(item.id) ? formatPLN(shareOf(item.id)) : "—"} </span>
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